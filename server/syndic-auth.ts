import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  SYNDIC_USERNAME,
  type SyndicIdentity,
  type SyndicSession,
} from "@shared/syndic";
import {
  users,
  syndicLoginRateLimits,
  syndicSessions,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { resolveConfiguredCondo } from "./condo-config";

export const SYNDIC_SESSION_COOKIE_NAME = "condo_syndic_session";
export const SYNDIC_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_PASSWORD_LENGTH = 128;

export const syndicLoginInputSchema = z.object({
  username: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  password: z.string().max(MAX_PASSWORD_LENGTH),
});

const PASSWORD_SALT = Buffer.from("condo-syndic-v1-salt", "utf8");
const DUMMY_PASSWORD_REFERENCE = randomBytes(32).toString("hex");
const MAX_SCRYPT_CONCURRENCY = 2;
let activeScryptJobs = 0;
const pendingScryptJobs: Array<() => void> = [];

export type LoginRateDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type LoginRateRow = typeof syndicLoginRateLimits.$inferSelect;
type DbLike = Awaited<ReturnType<typeof getDb>>;

function requireDbValue(db: DbLike) {
  if (!db) throw new Error("Database is not available");
  return db;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashSyndicSessionToken(token: string): string {
  return sessionTokenHash(token);
}

function clientAddress(req: {
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
}): string {
  // Express req.ip uses the connection address by default. Do not inspect or
  // trust x-forwarded-for: it is client-controlled unless proxy trust is
  // explicitly configured by the host.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateScopeForIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
}) {
  return `ip:${clientAddress(req)}`;
}

function beginScryptJob(): Promise<void> {
  if (activeScryptJobs < MAX_SCRYPT_CONCURRENCY) {
    activeScryptJobs += 1;
    return Promise.resolve();
  }
  return new Promise(resolve => pendingScryptJobs.push(resolve));
}

function endScryptJob() {
  const next = pendingScryptJobs.shift();
  if (next) {
    next();
    return;
  }
  activeScryptJobs -= 1;
}

async function derivePasswordHash(value: string): Promise<Buffer> {
  await beginScryptJob();
  try {
    const result = await new Promise<Buffer>((resolve, reject) => {
      scryptCallback(
        value,
        PASSWORD_SALT,
        32,
        {
          N: 16_384,
          r: 8,
          p: 1,
          maxmem: 64 * 1024 * 1024,
        },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey as Buffer);
        }
      );
    });
    return result;
  } finally {
    endScryptJob();
  }
}

export async function verifySyndicPassword(
  username: string,
  password: string,
  configuredPassword: string
): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  const [providedDigest, configuredDigest] = await Promise.all([
    derivePasswordHash(password),
    derivePasswordHash(configuredPassword),
  ]);
  const matches = timingSafeEqual(providedDigest, configuredDigest);
  return username === SYNDIC_USERNAME && matches;
}

function rateFailureCount(row: LoginRateRow | undefined, now: Date): number {
  if (!row) return 0;
  const startedAt = asDate(row.windowStartedAt);
  if (now.getTime() - startedAt.getTime() >= LOGIN_RATE_LIMIT_WINDOW_MS)
    return 0;
  return row.failures;
}

function rateBlockedUntil(
  row: LoginRateRow | undefined,
  now: Date
): Date | null {
  if (!row?.blockedUntil) return null;
  const blockedUntil = asDate(row.blockedUntil);
  return blockedUntil.getTime() > now.getTime() ? blockedUntil : null;
}

function retryAfterSeconds(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

async function withTransaction<T>(
  db: NonNullable<DbLike>,
  callback: (tx: NonNullable<DbLike>) => Promise<T>
) {
  const transaction = (db as unknown as { transaction?: unknown }).transaction;
  if (typeof transaction === "function") {
    return (
      db as unknown as {
        transaction: (
          fn: (tx: NonNullable<DbLike>) => Promise<T>
        ) => Promise<T>;
      }
    ).transaction(callback);
  }
  return callback(db);
}

async function lockRateRow(
  tx: NonNullable<DbLike>,
  scope: string
): Promise<LoginRateRow | undefined> {
  const query = tx
    .select()
    .from(syndicLoginRateLimits)
    .where(eq(syndicLoginRateLimits.scope, scope))
    .limit(1);
  const maybeFor = query as unknown as {
    for?: (strength: "update") => typeof query;
  };
  const rows = (await (typeof maybeFor.for === "function"
    ? maybeFor.for("update")
    : query)) as unknown as LoginRateRow[];
  return rows[0];
}

export async function reserveLoginAttempt(
  req: { ip?: string; socket?: { remoteAddress?: string | undefined } },
  now: Date
): Promise<LoginRateDecision> {
  const db = requireDbValue(await getDb());
  const scopes = ["global", rateScopeForIp(req)];
  return withTransaction(db, async tx => {
    const rows: Array<LoginRateRow | undefined> = [];
    for (const scope of scopes) {
      // The upsert creates and locks the scope even on the first concurrent request.
      await tx
        .insert(syndicLoginRateLimits)
        .values({
          scope,
          failures: 0,
          windowStartedAt: now,
          blockedUntil: null,
        })
        .onConflictDoNothing({ target: syndicLoginRateLimits.scope });
      rows.push(await lockRateRow(tx, scope));
    }
    let retryAfter = 0;
    for (const row of rows) {
      const blockedUntil = rateBlockedUntil(row, now);
      if (blockedUntil)
        retryAfter = Math.max(retryAfter, retryAfterSeconds(blockedUntil, now));
      if (rateFailureCount(row, now) >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
        const until = new Date(
          asDate(row?.windowStartedAt ?? now).getTime() +
            LOGIN_RATE_LIMIT_WINDOW_MS
        );
        retryAfter = Math.max(retryAfter, retryAfterSeconds(until, now));
      }
    }
    if (retryAfter > 0)
      return { allowed: false, retryAfterSeconds: retryAfter };
    for (let i = 0; i < scopes.length; i++) {
      const scope = scopes[i];
      const row = rows[i];
      const currentFailures = rateFailureCount(row, now);
      const failures = currentFailures + 1;
      const windowStartedAt =
        currentFailures === 0 ? now : asDate(row?.windowStartedAt ?? now);
      const blockedUntil =
        failures >= LOGIN_RATE_LIMIT_MAX_FAILURES
          ? new Date(windowStartedAt.getTime() + LOGIN_RATE_LIMIT_WINDOW_MS)
          : null;
      await tx
        .update(syndicLoginRateLimits)
        .set({ failures, windowStartedAt, blockedUntil, updatedAt: now })
        .where(eq(syndicLoginRateLimits.scope, scope));
    }
    return { allowed: true };
  });
}

async function resetLoginRateLimits(
  req: { ip?: string; socket?: { remoteAddress?: string | undefined } },
  now: Date
): Promise<void> {
  const db = requireDbValue(await getDb());
  const scopes = ["global", rateScopeForIp(req)];
  await withTransaction(db, async tx => {
    await tx
      .update(syndicLoginRateLimits)
      .set({
        failures: 0,
        windowStartedAt: now,
        blockedUntil: null,
        updatedAt: now,
      })
      .where(inArray(syndicLoginRateLimits.scope, scopes));
  });
}

function loginError(
  code: "UNAUTHORIZED" | "SERVICE_UNAVAILABLE",
  message: string
) {
  return new TRPCError({ code, message });
}

export async function getSyndicIdentity(
  ownerId: number
): Promise<SyndicIdentity | null> {
  const db = requireDbValue(await getDb());
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  return {
    id: user.id,
    username: SYNDIC_USERNAME,
    name: user.name?.trim() || "Síndico",
    email: null,
  };
}

export async function getSyndicSessionFromRequest(
  req: {
    headers: { cookie?: string };
    ip?: string;
    socket?: { remoteAddress?: string | undefined };
  },
  now = new Date()
): Promise<SyndicSession | null> {
  const rawToken = parseCookieHeader(req.headers.cookie ?? "")[
    SYNDIC_SESSION_COOKIE_NAME
  ];
  if (!rawToken || rawToken.length > 128 || !/^[a-f0-9]{64}$/i.test(rawToken))
    return null;

  const db = await getDb();
  if (!db) return null;
  const tokenHash = sessionTokenHash(rawToken);
  const rows = await db
    .select()
    .from(syndicSessions)
    .where(eq(syndicSessions.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row || asDate(row.expiresAt).getTime() <= now.getTime()) return null;

  const resolution = await resolveConfiguredCondo();
  if (
    resolution.kind !== "configured" ||
    resolution.condo?.ownerId !== row.ownerId
  )
    return null;

  return {
    ownerId: row.ownerId,
    tokenHash: row.tokenHash,
    expiresAt: asDate(row.expiresAt),
  };
}

export async function loginSyndic(
  input: { username: string; password: string },
  req: { ip?: string; socket?: { remoteAddress?: string | undefined } },
  res: {
    cookie: (
      name: string,
      value: string,
      options: Record<string, unknown>
    ) => void;
  },
  now = new Date()
): Promise<{ success: true }> {
  const configuredPassword = process.env.CONDO_ADMIN_PASSWORD;
  if (!configuredPassword) {
    throw loginError(
      "SERVICE_UNAVAILABLE",
      "O login do síndico não está configurado."
    );
  }

  const resolution = await resolveConfiguredCondo();
  if (resolution.kind === "ambiguous") {
    throw loginError(
      "SERVICE_UNAVAILABLE",
      "A configuração do condomínio está indisponível."
    );
  }
  if (resolution.kind === "empty" || !resolution.condo) {
    throw loginError("UNAUTHORIZED", "Usuário ou senha inválidos.");
  }

  const rate = await reserveLoginAttempt(req, now);
  if (!rate.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas de login. Tente novamente mais tarde.",
      cause: { retryAfterSeconds: rate.retryAfterSeconds },
    });
  }

  const passwordMatches = await verifySyndicPassword(
    input.username,
    input.password,
    input.username === SYNDIC_USERNAME
      ? configuredPassword
      : DUMMY_PASSWORD_REFERENCE
  );
  if (!passwordMatches) {
    throw loginError("UNAUTHORIZED", "Usuário ou senha inválidos.");
  }

  const db = requireDbValue(await getDb());
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + SYNDIC_SESSION_TTL_MS);
  await db.insert(syndicSessions).values({
    ownerId: resolution.condo.ownerId,
    tokenHash: sessionTokenHash(rawToken),
    expiresAt,
  });
  await resetLoginRateLimits(req, now);
  res.cookie(SYNDIC_SESSION_COOKIE_NAME, rawToken, {
    ...getSessionCookieOptions(req as never),
    maxAge: SYNDIC_SESSION_TTL_MS,
  });
  return { success: true };
}

export async function logoutSyndic(
  req: { headers: { cookie?: string } },
  res: { clearCookie: (name: string, options: Record<string, unknown>) => void }
): Promise<{ success: true }> {
  const rawToken = parseCookieHeader(req.headers.cookie ?? "")[
    SYNDIC_SESSION_COOKIE_NAME
  ];
  try {
    if (
      rawToken &&
      rawToken.length <= 128 &&
      /^[a-f0-9]{64}$/i.test(rawToken)
    ) {
      const db = requireDbValue(await getDb());
      await db
        .delete(syndicSessions)
        .where(eq(syndicSessions.tokenHash, sessionTokenHash(rawToken)));
    }
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "A sessão foi removida deste navegador, mas a revogação no servidor não pôde ser confirmada.",
    });
  } finally {
    const options = { ...getSessionCookieOptions(req as never), maxAge: -1 };
    res.clearCookie(SYNDIC_SESSION_COOKIE_NAME, options);
    // Old platform sessions never grant syndic access, but remove their stale cookie too.
    res.clearCookie(COOKIE_NAME, options);
  }
  return { success: true };
}

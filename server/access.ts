import { randomBytes, createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  attachUnitSnapshots,
  condoStateSchema,
  initialState,
  type CondoState,
} from "@shared/condo";
import {
  RESIDENT_INVITE_TOKEN_PATTERN,
  RESIDENT_INVITE_VALIDITY_DAYS,
  type CondoAccess,
} from "@shared/access";
import {
  condoInvites,
  condoMemberships,
  condoStates,
  users,
  type CondoInvite,
  type CondoMembership,
} from "../drizzle/schema";
import { getDb } from "./db";

export const accessCreateInviteInputSchema = z.object({
  email: z.email(),
  unitId: z.string().trim().min(1).max(80),
});

export const accessAcceptInviteInputSchema = z.object({
  token: z.string().regex(RESIDENT_INVITE_TOKEN_PATTERN),
});

export const accessRevokeMemberInputSchema = z.object({
  membershipId: z.number().int().positive(),
});

export const accessRevokeInviteInputSchema = z.object({
  inviteId: z.number().int().positive(),
});

export type AccessInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type PersistedCondo = {
  ownerId: number;
  state: CondoState;
  revision: number;
};

export type ResolvedCondoAccess = {
  access: CondoAccess;
  condo?: PersistedCondo;
};

const ACCESS_FORBIDDEN_MESSAGE =
  "Apenas o síndico responsável pelo condomínio pode executar esta ação.";
const INVALID_INVITE_MESSAGE =
  "O convite não é válido ou já não está disponível.";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parsePersistedState(value: unknown): CondoState {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new Error(
        "O estado persistido do condomínio não é um JSON válido."
      );
    }
  }

  const parsed = condoStateSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      "O estado persistido do condomínio não atende ao contrato atual."
    );
  }
  return attachUnitSnapshots(parsed.data);
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function findCondoState(
  ownerId: number
): Promise<PersistedCondo | undefined> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(condoStates)
    .where(eq(condoStates.ownerId, ownerId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  if (!Number.isInteger(row.revision) || row.revision < 0) {
    throw new Error("A revisão persistida do condomínio é inválida.");
  }
  return {
    ownerId: row.ownerId,
    state: parsePersistedState(row.state),
    revision: row.revision,
  };
}

/**
 * Resolves access from database relationships only. In particular, no client
 * supplied role or owner id participates in this decision.
 */
export async function resolveCondoAccess(
  userId: number
): Promise<ResolvedCondoAccess> {
  const owned = await findCondoState(userId);
  if (owned) {
    return { access: { role: "syndic", ownerId: userId }, condo: owned };
  }

  const db = await requireDb();
  const membershipRows = await db
    .select()
    .from(condoMemberships)
    .where(eq(condoMemberships.userId, userId))
    .limit(1);
  const membership = membershipRows[0];
  if (!membership) {
    return { access: { role: "unlinked", ownerId: null } };
  }

  const condo = await findCondoState(membership.ownerId);
  if (!condo) {
    // A manually removed owner state must not leave an orphaned tenant with
    // access to another owner's data.
    return { access: { role: "unlinked", ownerId: null } };
  }

  return {
    access: {
      role: "resident",
      ownerId: membership.ownerId,
      unitId: membership.unitId,
    },
    condo,
  };
}

export async function requireSyndicCondo(
  userId: number
): Promise<PersistedCondo> {
  const condo = await findCondoState(userId);
  if (!condo) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ACCESS_FORBIDDEN_MESSAGE,
    });
  }
  return condo;
}

/** A resident receives only their unit; common expenses and allocation snapshots remain. */
export function filterCondoStateForResident(
  state: CondoState,
  unitId: string
): CondoState {
  const ownUnit = state.units.find(unit => unit.id === unitId);
  return {
    name: state.name,
    units: ownUnit ? [{ ...ownUnit }] : [],
    months: state.months.map(month => ({
      ...month,
      charges: month.charges
        .filter(charge => charge.unitId === unitId)
        .map(charge => ({
          ...charge,
          unitSnapshot: charge.unitSnapshot && { ...charge.unitSnapshot },
        })),
      expenses: month.expenses.map(expense => ({ ...expense })),
      allocation: month.allocation
        ? {
            method: month.allocation.method,
            participants: month.allocation.participants.map(participant => ({
              unitId: participant.unitId,
              weight: participant.weight,
            })),
          }
        : undefined,
    })),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    errno?: unknown;
    cause?: unknown;
  };
  return (
    candidate.code === "ER_DUP_ENTRY" ||
    candidate.errno === 1062 ||
    (candidate.cause !== error && isDuplicateKeyError(candidate.cause))
  );
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  const value = (header as { affectedRows?: unknown }).affectedRows;
  return Number(value ?? 0);
}

function insertedId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") {
    throw new Error("O banco não retornou o identificador do convite.");
  }
  const value = (header as { insertId?: unknown }).insertId;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("O banco não retornou o identificador do convite.");
  }
  return id;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getInviteStatus(
  invite: Pick<CondoInvite, "acceptedAt" | "revokedAt" | "expiresAt">,
  now = new Date()
): AccessInviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.acceptedAt) return "accepted";
  if (asDate(invite.expiresAt).getTime() <= now.getTime()) return "expired";
  return "pending";
}

export async function listAccessForSyndic(userId: number) {
  const { ownerId } = await requireSyndicCondo(userId);
  const db = await requireDb();

  const [membershipRows, inviteRows] = await Promise.all([
    db
      .select()
      .from(condoMemberships)
      .where(eq(condoMemberships.ownerId, ownerId)),
    db.select().from(condoInvites).where(eq(condoInvites.ownerId, ownerId)),
  ]);

  const memberUserIds = membershipRows.map(member => member.userId);
  const memberUsers = memberUserIds.length
    ? await db.select().from(users).where(inArray(users.id, memberUserIds))
    : [];
  const usersById = new Map(memberUsers.map(user => [user.id, user]));

  return {
    members: membershipRows.map(member => {
      const user = usersById.get(member.userId);
      return {
        id: member.id,
        userName: user?.name ?? user?.email ?? "Morador",
        email: user?.email ?? "",
        unitId: member.unitId,
        role: "resident" as const,
      };
    }),
    invitations: inviteRows.map(invite => ({
      id: invite.id,
      email: invite.email,
      unitId: invite.unitId,
      expiresAt: asDate(invite.expiresAt),
      status: getInviteStatus(invite),
    })),
  };
}

export async function createInviteForSyndic(
  userId: number,
  actorEmail: string | null | undefined,
  input: z.infer<typeof accessCreateInviteInputSchema>
) {
  const { ownerId, state } = await requireSyndicCondo(userId);
  const email = normalizeEmail(input.email);
  const ownEmail = actorEmail ? normalizeEmail(actorEmail) : "";
  if (ownEmail && email === ownEmail) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O síndico não pode convidar o próprio e-mail.",
    });
  }

  const unit = state.units.find(
    candidate => candidate.id === input.unitId && candidate.active
  );
  if (!unit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A unidade informada não existe ou não está ativa.",
    });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + RESIDENT_INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  );
  const db = await requireDb();
  const result = await db.insert(condoInvites).values({
    ownerId,
    email,
    unitId: unit.id,
    tokenHash,
    expiresAt,
  });

  return { id: insertedId(result), token: rawToken, expiresAt };
}

export async function acceptInviteForUser(
  userId: number,
  userEmail: string | null | undefined,
  token: string
): Promise<Extract<CondoAccess, { role: "resident" }>> {
  const email = userEmail ? normalizeEmail(userEmail) : "";
  if (!email) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "A conta autenticada precisa ter um e-mail para aceitar convites.",
    });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = await requireDb();
  try {
    return await db.transaction(async tx => {
      const selectQuery = tx
        .select()
        .from(condoInvites)
        .where(eq(condoInvites.tokenHash, tokenHash))
        .limit(1);
      // Keep the lock in the transaction. The fallback only makes focused
      // mocks usable; the real Drizzle MySQL builder always has .for().
      const lockedQuery =
        typeof (selectQuery as unknown as { for?: unknown }).for === "function"
          ? (
              selectQuery as unknown as {
                for: (strength: "update") => typeof selectQuery;
              }
            ).for("update")
          : selectQuery;
      const rows = await lockedQuery;
      const invite = rows[0];
      if (!invite || getInviteStatus(invite) !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: INVALID_INVITE_MESSAGE,
        });
      }
      if (normalizeEmail(invite.email) !== email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Este convite foi emitido para outro e-mail.",
        });
      }

      const existingRows = await tx
        .select()
        .from(condoMemberships)
        .where(eq(condoMemberships.userId, userId))
        .limit(1);
      const existing = existingRows[0];
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta conta já possui um vínculo de morador.",
        });
      }

      const now = new Date();
      const update = await tx
        .update(condoInvites)
        .set({ acceptedAt: now })
        .where(
          and(
            eq(condoInvites.id, invite.id),
            isNull(condoInvites.acceptedAt),
            isNull(condoInvites.revokedAt)
          )
        );
      if (affectedRows(update) !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: INVALID_INVITE_MESSAGE,
        });
      }

      await tx.insert(condoMemberships).values({
        ownerId: invite.ownerId,
        userId,
        unitId: invite.unitId,
      });
      return {
        role: "resident",
        ownerId: invite.ownerId,
        unitId: invite.unitId,
      };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (isDuplicateKeyError(error)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Esta conta já possui um vínculo de morador.",
      });
    }
    throw error;
  }
}

export async function revokeMemberForSyndic(
  userId: number,
  membershipId: number
): Promise<{ success: true }> {
  const { ownerId } = await requireSyndicCondo(userId);
  const db = await requireDb();
  const result = await db
    .delete(condoMemberships)
    .where(
      and(
        eq(condoMemberships.id, membershipId),
        eq(condoMemberships.ownerId, ownerId)
      )
    );
  if (affectedRows(result) !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Vínculo não encontrado.",
    });
  }
  return { success: true };
}

export async function revokeInviteForSyndic(
  userId: number,
  inviteId: number
): Promise<{ success: true }> {
  const { ownerId } = await requireSyndicCondo(userId);
  const db = await requireDb();
  const result = await db
    .update(condoInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(condoInvites.id, inviteId),
        eq(condoInvites.ownerId, ownerId),
        isNull(condoInvites.acceptedAt),
        isNull(condoInvites.revokedAt)
      )
    );
  if (affectedRows(result) !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Convite pendente não encontrado.",
    });
  }
  return { success: true };
}

export const emptyUnlinkedCondo = {
  state: initialState,
  revision: 0,
  access: { role: "unlinked", ownerId: null } as const,
};

export type { CondoInvite, CondoMembership };

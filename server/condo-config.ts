import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { condoStateSchema, initialState, type CondoState } from "@shared/condo";
import { condoStates } from "../drizzle/schema";
import { getDb } from "./db";

export const DEFAULT_PUBLIC_CONDO_NAME = initialState.name;

type ConfiguredCondo = {
  ownerId: number;
  state: CondoState;
};

export type ConfiguredCondoResolution =
  | { kind: "configured"; condo: ConfiguredCondo }
  | { kind: "empty"; condo: null }
  | { kind: "ambiguous"; condo: null };

function parsePersistedState(value: unknown): CondoState {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "O estado persistido do condomínio é inválido.",
      });
    }
  }

  const parsed = condoStateSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "O estado persistido do condomínio é inválido.",
    });
  }
  return parsed.data;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

/**
 * There is deliberately no fallback to the first row. A public board and an
 * admin login must never silently choose an owner when the database is
 * misconfigured with multiple condominium states.
 */
export async function resolveConfiguredCondo(): Promise<ConfiguredCondoResolution> {
  const db = await requireDb();
  const rows = await db.select().from(condoStates).limit(2);

  if (rows.length === 0) return { kind: "empty", condo: null };
  if (rows.length > 1) return { kind: "ambiguous", condo: null };

  const row = rows[0];
  if (!row || !Number.isInteger(row.ownerId) || row.ownerId <= 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "A configuração do condomínio é inválida.",
    });
  }

  return {
    kind: "configured",
    condo: {
      ownerId: row.ownerId,
      state: parsePersistedState(row.state),
    },
  };
}

export function getPublicStateFromResolution(
  resolution: ConfiguredCondoResolution
): { ownerId: number | null; state: CondoState } {
  if (resolution.kind === "configured" && resolution.condo) {
    return { ownerId: resolution.condo.ownerId, state: resolution.condo.state };
  }
  if (resolution.kind === "empty") {
    return {
      ownerId: null,
      state: { ...initialState, name: DEFAULT_PUBLIC_CONDO_NAME },
    };
  }
  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "A configuração pública do condomínio está indisponível.",
  });
}

export async function isConfiguredOwner(ownerId: number): Promise<boolean> {
  const resolution = await resolveConfiguredCondo();
  return (
    resolution.kind === "configured" && resolution.condo?.ownerId === ownerId
  );
}

export async function getConfiguredOwnerId(): Promise<number | null> {
  const resolution = await resolveConfiguredCondo();
  return resolution.kind === "configured"
    ? (resolution.condo?.ownerId ?? null)
    : null;
}

export async function hasCondoState(ownerId: number): Promise<boolean> {
  const db = await requireDb();
  const rows = await db
    .select({ ownerId: condoStates.ownerId })
    .from(condoStates)
    .where(eq(condoStates.ownerId, ownerId))
    .limit(1);
  return rows.length === 1;
}

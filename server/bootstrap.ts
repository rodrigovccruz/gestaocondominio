import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { initialState, type CondoState } from "@shared/condo";
import { condoStates, users } from "../drizzle/schema";
import { getDb } from "./db";

/** Lê CONDO_UNITS ("101,102,201") e devolve os números, sem repetidos. */
export function parseUnitList(raw: string | undefined): string[] {
  const numbers = (raw ?? "")
    .split(/[,;\s]+/)
    .map(n => n.trim())
    .filter(Boolean);
  return Array.from(new Set(numbers));
}

export function firstState(
  name: string | undefined,
  units: string[]
): CondoState {
  return {
    ...initialState,
    name: name?.trim() || initialState.name,
    units: units.map(number => ({
      id: `apto-${number}`,
      number,
      resident: "",
      active: true,
      exempt: false,
    })),
  };
}

/**
 * Prepara um banco novo: aplica as migrações e, se não houver condomínio,
 * cria o síndico e os apartamentos de CONDO_UNITS. Não mexe em banco que já
 * tem condomínio.
 */
export async function prepareDatabase(migrationsFolder?: string) {
  const db = await getDb();
  if (!db) return;
  if (migrationsFolder && existsSync(migrationsFolder))
    await migrate(db, { migrationsFolder });

  const units = parseUnitList(process.env.CONDO_UNITS);
  if (!units.length) return;
  const existing = await db
    .select({ ownerId: condoStates.ownerId })
    .from(condoStates)
    .limit(1);
  if (existing.length) return;

  await db
    .insert(users)
    .values({ openId: "sindico", name: "Síndico", role: "admin" })
    .onConflictDoNothing({ target: users.openId });
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eqOpenId("sindico"))
    .limit(1);
  if (!owner) throw new Error("Não foi possível criar o síndico.");
  await db.insert(condoStates).values({
    ownerId: owner.id,
    revision: 0,
    state: firstState(process.env.CONDO_NAME, units),
  });
  console.log(`[setup] Condomínio criado com ${units.length} apartamentos.`);
}

const eqOpenId = (openId: string) => eq(users.openId, openId);

let ready: Promise<void> | null = null;
/** Roda uma vez por instância; se falhar, tenta de novo na próxima requisição. */
export function ensureDatabaseReady(migrationsFolder?: string) {
  ready ??= prepareDatabase(migrationsFolder).catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}

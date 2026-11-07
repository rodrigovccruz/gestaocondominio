import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  condoStateSchema,
  initialState,
  type CondoState,
  type Month,
} from "@shared/condo";
import { condoStates } from "../drizzle/schema";
import { getDb } from "./db";
import { router, syndicProcedure } from "./_core/trpc";

export const condoSaveInputSchema = z.object({
  revision: z.number().int().min(0),
  state: condoStateSchema,
});

export const CONDO_REVISION_CONFLICT_MESSAGE =
  "Os dados foram alterados em outra aba ou aparelho. Recarregue e tente de novo.";

export class CondoConflictError extends Error {
  constructor(message = CONDO_REVISION_CONFLICT_MESSAGE) {
    super(message);
    this.name = "CondoConflictError";
  }
}

export class CondoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CondoValidationError";
  }
}

/** Lê o JSON salvo (formato atual ou antigo) e valida. */
export function parseState(value: unknown): CondoState {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new Error("O estado salvo do condomínio não é um JSON válido.");
    }
  }
  const parsed = condoStateSchema.safeParse(candidate);
  if (!parsed.success)
    throw new Error("O estado salvo do condomínio é inválido.");
  return parsed.data;
}

function withoutStatus(month: Month) {
  const { status: _status, ...content } = month;
  return content;
}

/**
 * Mês fechado não muda. Para corrigir, reabre (só troca o status) e edita.
 */
export function validateClosedCompetenceChanges(
  saved: CondoState,
  next: CondoState
): void {
  const nextById = new Map(next.months.map(m => [m.id, m]));
  for (const savedMonth of saved.months) {
    const nextMonth = nextById.get(savedMonth.id);
    if (!nextMonth) {
      if (savedMonth.status === "closed")
        throw new CondoValidationError(
          `O mês ${savedMonth.competence} está fechado e não pode ser apagado.`
        );
      continue;
    }
    const changed = !isDeepStrictEqual(
      withoutStatus(savedMonth),
      withoutStatus(nextMonth)
    );
    if (savedMonth.status === "closed" && changed)
      throw new CondoValidationError(
        `O mês ${savedMonth.competence} está fechado. Reabra antes de alterar.`
      );
    if (savedMonth.status !== nextMonth.status && changed)
      throw new CondoValidationError(
        `Feche ou reabra o mês ${savedMonth.competence} sem alterar lançamentos ao mesmo tempo.`
      );
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

async function findSavedState(ownerId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(condoStates)
    .where(eq(condoStates.ownerId, ownerId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  if (!Number.isInteger(row.revision) || row.revision < 0)
    throw new Error("A revisão salva do condomínio é inválida.");
  return { state: parseState(row.state), revision: row.revision };
}

export async function getCondoState(
  ownerId: number
): Promise<{ state: CondoState; revision: number }> {
  const saved = await findSavedState(ownerId);
  return saved ?? { state: initialState, revision: 0 };
}

/**
 * Salva o estado inteiro com controle de revisão (evita sobrescrever outra aba).
 * Só atualiza um condomínio que já existe: o login nunca cria um novo.
 */
export async function saveCondoState(
  ownerId: number,
  expectedRevision: number,
  requestedState: CondoState
): Promise<{ state: CondoState; revision: number }> {
  const nextState = parseState(requestedState);
  const db = await requireDb();
  const saved = await findSavedState(ownerId);
  if (!saved)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Condomínio não configurado para esta sessão.",
    });

  if (saved.revision !== expectedRevision) throw new CondoConflictError();
  validateClosedCompetenceChanges(saved.state, nextState);

  const updated = await db
    .update(condoStates)
    .set({ state: nextState, revision: sql`${condoStates.revision} + 1` })
    .where(
      and(
        eq(condoStates.ownerId, ownerId),
        eq(condoStates.revision, expectedRevision)
      )
    )
    .returning({ ownerId: condoStates.ownerId });
  if (updated.length !== 1) throw new CondoConflictError();
  return { state: nextState, revision: expectedRevision + 1 };
}

function rethrowCondoError(error: unknown): never {
  if (error instanceof CondoConflictError)
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  if (error instanceof CondoValidationError)
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw error;
}

export const condoRouter = router({
  get: syndicProcedure.query(({ ctx }) => getCondoState(ctx.syndic.ownerId)),
  save: syndicProcedure
    .input(condoSaveInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveCondoState(
          ctx.syndic.ownerId,
          input.revision,
          input.state
        );
      } catch (error) {
        rethrowCondoError(error);
      }
    }),
});

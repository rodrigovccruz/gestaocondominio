import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  attachUnitSnapshots,
  condoStateSchema,
  initialState,
  type CondoState,
  type Month,
} from "@shared/condo";
import type { CondoReadResponse } from "@shared/access";
import { makeAllocationConfig } from "@shared/rateio";
import { condoStates } from "../drizzle/schema";
import { getDb } from "./db";
import { router, syndicProcedure } from "./_core/trpc";
import {
  filterCondoStateForResident,
  requireSyndicCondo,
  resolveCondoAccess,
} from "./access";

export const condoSaveInputSchema = z.object({
  revision: z.number().int().min(0),
  state: condoStateSchema,
});

export const CONDO_REVISION_CONFLICT_MESSAGE =
  "O estado do condomínio foi alterado por outra sessão. Recarregue os dados e tente novamente.";
export const CONDO_DUPLICATE_SAVE_MESSAGE =
  "Já existe um estado salvo para este usuário.";

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

function parseState(value: unknown): CondoState {
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

function stateWithoutStatus(month: Month) {
  const { status: _status, ...content } = month;
  return content;
}

/**
 * Closed months are immutable except for an isolated status transition. In
 * particular, reopening a month is only valid when every other field is
 * byte-for-byte equivalent to the persisted month.
 */
export function validateClosedCompetenceChanges(
  savedState: CondoState,
  nextState: CondoState
): void {
  const nextMonthsById = new Map(
    nextState.months.map(month => [month.id, month])
  );

  for (const savedMonth of savedState.months) {
    const nextMonth = nextMonthsById.get(savedMonth.id);
    if (!nextMonth && savedMonth.status === "closed") {
      throw new CondoValidationError(
        `A competência ${savedMonth.competence} está fechada e não pode ser removida.`
      );
    }
    if (!nextMonth) continue;

    const contentChanged = !isDeepStrictEqual(
      stateWithoutStatus(savedMonth),
      stateWithoutStatus(nextMonth)
    );
    if (savedMonth.status === "closed" && contentChanged) {
      throw new CondoValidationError(
        `A competência ${savedMonth.competence} está fechada e não pode ter seu conteúdo financeiro alterado.`
      );
    }
    if (savedMonth.status !== nextMonth.status && contentChanged) {
      throw new CondoValidationError(
        `A troca de status da competência ${savedMonth.competence} deve ser isolada do conteúdo financeiro.`
      );
    }
  }
}

/** Only changed snapshots are checked against today's register; history stays frozen. */
export function validateAllocationChanges(
  savedState: CondoState | undefined,
  nextState: CondoState
): void {
  for (const month of nextState.months) {
    const previous = savedState?.months.find(
      savedMonth => savedMonth.id === month.id
    );
    if (
      !month.allocation ||
      isDeepStrictEqual(previous?.allocation, month.allocation)
    )
      continue;
    try {
      const expected = makeAllocationConfig(
        nextState,
        month.allocation.method,
        month.allocation.participants.map(p => p.unitId)
      );
      const ordered = (participants: typeof expected.participants) =>
        [...participants].sort((a, b) =>
          a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0
        );
      if (
        !isDeepStrictEqual(
          ordered(expected.participants),
          ordered(month.allocation.participants)
        )
      )
        throw new Error(
          "Os pesos do rateio devem corresponder às frações ideais atuais das unidades selecionadas."
        );
    } catch (error) {
      throw new CondoValidationError(
        error instanceof Error
          ? error.message
          : "Configuração de rateio inválida."
      );
    }
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
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
  if (!Number.isInteger(row.revision) || row.revision < 0) {
    throw new Error("A revisão persistida do condomínio é inválida.");
  }

  return {
    row,
    state: parseState(row.state),
    revision: row.revision,
  };
}

export async function getCondoState(
  ownerId: number
): Promise<{ state: CondoState; revision: number }> {
  const saved = await findSavedState(ownerId);
  if (!saved) {
    return { state: parseState(initialState), revision: 0 };
  }
  return { state: saved.state, revision: saved.revision };
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

export async function saveCondoState(
  ownerId: number,
  expectedRevision: number,
  requestedState: CondoState
): Promise<{ state: CondoState; revision: number }> {
  const nextState = parseState(requestedState);
  const db = await requireDb();
  const saved = await findSavedState(ownerId);

  if (!saved) {
    if (expectedRevision !== 0) {
      throw new CondoConflictError();
    }

    validateAllocationChanges(undefined, nextState);
    try {
      await db.insert(condoStates).values({
        ownerId,
        revision: 1,
        state: nextState,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CondoConflictError(CONDO_DUPLICATE_SAVE_MESSAGE);
      }
      throw error;
    }

    return { state: nextState, revision: 1 };
  }

  if (saved.revision !== expectedRevision) {
    throw new CondoConflictError();
  }
  validateClosedCompetenceChanges(saved.state, nextState);
  validateAllocationChanges(saved.state, nextState);

  const result = await db
    .update(condoStates)
    .set({
      state: nextState,
      revision: sql`${condoStates.revision} + 1`,
    })
    .where(
      and(
        eq(condoStates.ownerId, ownerId),
        eq(condoStates.revision, expectedRevision)
      )
    );

  const affectedRows = Number(result[0].affectedRows ?? 0);
  if (affectedRows !== 1) {
    throw new CondoConflictError();
  }

  return { state: nextState, revision: expectedRevision + 1 };
}

function rethrowCondoError(error: unknown): never {
  if (error instanceof CondoConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof CondoValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export async function getCondoReadResponse(
  userId: number
): Promise<CondoReadResponse> {
  const resolved = await resolveCondoAccess(userId);
  if (!resolved.condo) {
    return {
      state: parseState(initialState),
      revision: 0,
      access: { role: "unlinked", ownerId: null },
    };
  }

  if (resolved.access.role === "resident") {
    return {
      state: filterCondoStateForResident(
        resolved.condo.state,
        resolved.access.unitId
      ),
      revision: resolved.condo.revision,
      access: resolved.access,
    };
  }

  return {
    state: resolved.condo.state,
    revision: resolved.condo.revision,
    access: resolved.access,
  };
}

export async function getSyndicCondoReadResponse(ownerId: number) {
  const saved = await getCondoState(ownerId);
  return {
    ...saved,
    access: { role: "syndic", ownerId } as const,
  };
}

export const condoRouter = router({
  get: syndicProcedure.query(async ({ ctx }) =>
    getSyndicCondoReadResponse(ctx.syndic.ownerId)
  ),
  save: syndicProcedure
    .input(condoSaveInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await requireSyndicCondo(ctx.syndic.ownerId);
        const saved = await saveCondoState(
          ctx.syndic.ownerId,
          input.revision,
          input.state
        );
        return {
          ...saved,
          access: { role: "syndic", ownerId: ctx.syndic.ownerId } as const,
        };
      } catch (error) {
        rethrowCondoError(error);
      }
    }),
});

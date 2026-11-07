import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, type CondoState } from "../shared/condo";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  CONDO_DUPLICATE_SAVE_MESSAGE,
  saveCondoState,
  validateClosedCompetenceChanges,
} from "./condo";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

type SavedRow = {
  ownerId: number;
  revision: number;
  state: CondoState;
  createdAt: Date;
  updatedAt: Date;
};

function makeDb(
  options: {
    row?: SavedRow;
    affectedRows?: number;
    insertError?: unknown;
  } = {}
) {
  const insertedValues: unknown[] = [];
  const updatedValues: unknown[] = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (options.row ? [options.row] : [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        insertedValues.push(values);
        if (options.insertError) throw options.insertError;
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updatedValues.push(values);
        return {
          where: vi.fn(async () => [
            { affectedRows: options.affectedRows ?? 1 },
            [],
          ]),
        };
      }),
    })),
  };
  return { db, insertedValues, updatedValues };
}

function context(userId: number | null): TrpcContext {
  return {
    user:
      userId === null
        ? null
        : {
            id: userId,
            openId: `user-${userId}`,
            name: "Usuário de teste",
            email: `user-${userId}@example.com`,
            loginMethod: "manus",
            role: "user",
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          },
    syndic:
      userId === null
        ? null
        : {
            ownerId: userId,
            tokenHash: "a".repeat(64),
            expiresAt: new Date(Date.now() + 60_000),
          },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const state: CondoState = {
  ...initialState,
  name: "Condomínio de teste",
};

describe("condo router e persistência", () => {
  beforeEach(() => getDbMock.mockReset());

  it("exige autenticação para consultar o estado", async () => {
    getDbMock.mockResolvedValue(makeDb().db);
    const caller = appRouter.createCaller(context(null));

    await expect(caller.condo.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("retorna o estado inicial sem criar uma linha no banco", async () => {
    const { db } = makeDb();
    getDbMock.mockResolvedValue(db);

    const result = await appRouter.createCaller(context(42)).condo.get();

    expect(result).toEqual({
      state: initialState,
      revision: 0,
      access: { role: "syndic", ownerId: 42 },
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("não permite que o primeiro login se promova a síndico", async () => {
    const { db } = makeDb();
    getDbMock.mockResolvedValue(db);

    await expect(
      appRouter.createCaller(context(42)).condo.save({ revision: 0, state })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("não sobrescreve o primeiro estado com uma consulta inicial desatualizada", async () => {
    const { db, updatedValues } = makeDb({
      row: {
        ownerId: 42,
        revision: 1,
        state,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    getDbMock.mockResolvedValue(db);
    await expect(
      appRouter
        .createCaller(context(42))
        .condo.save({ revision: 0, state: initialState })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updatedValues).toHaveLength(0);
  });

  it("converte duplicidade do primeiro insert em CONFLICT em português", async () => {
    const { db } = makeDb({
      insertError: { cause: { code: "ER_DUP_ENTRY", errno: 1062 } },
    });
    getDbMock.mockResolvedValue(db);

    const request = saveCondoState(42, 0, state);

    await expect(request).rejects.toThrow(CONDO_DUPLICATE_SAVE_MESSAGE);
  });

  it("faz update apenas quando ownerId e revisão esperada coincidem", async () => {
    const row: SavedRow = {
      ownerId: 42,
      revision: 4,
      state,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { db, updatedValues } = makeDb({ row });
    getDbMock.mockResolvedValue(db);

    const result = await appRouter
      .createCaller(context(42))
      .condo.save({ revision: 4, state });

    expect(result).toEqual({
      state,
      revision: 5,
      access: { role: "syndic", ownerId: 42 },
    });
    expect(updatedValues).toHaveLength(1);
  });

  it("retorna CONFLICT quando o CAS não afeta exatamente uma linha", async () => {
    const row: SavedRow = {
      ownerId: 42,
      revision: 4,
      state,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    getDbMock.mockResolvedValue(makeDb({ row, affectedRows: 0 }).db);

    const request = appRouter
      .createCaller(context(42))
      .condo.save({ revision: 4, state });

    await expect(request).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("não usa o estado inicial quando o banco está indisponível", async () => {
    getDbMock.mockResolvedValue(null);

    await expect(
      appRouter.createCaller(context(42)).condo.get()
    ).rejects.toThrow("Database is not available");
  });

  it("permite reabrir competência fechada apenas alterando status", () => {
    const closedState: CondoState = {
      ...state,
      months: [
        {
          id: "month-2026-01",
          competence: "2026-01",
          status: "closed",
          waterRateCents: 1,
          gasRateCents: 1,
          openingBalanceCents: 0,
          charges: [],
          expenses: [],
        },
      ],
    };
    const reopenedState: CondoState = {
      ...closedState,
      months: [{ ...closedState.months[0]!, status: "open" }],
    };

    expect(() =>
      validateClosedCompetenceChanges(closedState, reopenedState)
    ).not.toThrow();
    expect(() =>
      validateClosedCompetenceChanges(closedState, {
        ...reopenedState,
        months: [{ ...reopenedState.months[0]!, waterRateCents: 2 }],
      })
    ).toThrow(/fechada/);
  });
});

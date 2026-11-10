import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyTariffs, initialState, type CondoState } from "../shared/condo";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { parseState, validateClosedCompetenceChanges } from "./condo";

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
          where: vi.fn(() => ({
            returning: vi.fn(async () =>
              Array.from({ length: options.affectedRows ?? 1 }, () => ({
                ownerId: 1,
              }))
            ),
          })),
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
  units: [
    { id: "u1", number: "101", resident: "", active: true, exempt: false },
  ],
};

const closedMonth: CondoState["months"][number] = {
  id: "month-2026-01",
  competence: "2026-01",
  status: "closed",
  feeCents: 0,
  maintenanceBp: 0,
  reserveBp: 0,
  adminCents: 0,
  waterPriceCents: 0,
  gasPriceCents: 0,
  readings: [
    {
      unitId: "u1",
      waterPrevious: 0,
      waterCurrent: 1000,
      gasPrevious: 0,
      gasCurrent: 0,
    },
  ],
  expenses: [
    {
      id: "e1",
      description: "Copasa",
      category: "Água",
      amountCents: 5000,
      fromReserve: false,
    },
  ],
  payments: [],
  extraCharges: [],
  bankBalanceCents: null,
};

function savedRow(revision: number, rowState: CondoState = state): SavedRow {
  return {
    ownerId: 42,
    revision,
    state: rowState,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

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
    expect(result).toEqual({ state: initialState, revision: 0 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("não cria condomínio novo a partir de um login", async () => {
    const { db } = makeDb();
    getDbMock.mockResolvedValue(db);
    await expect(
      appRouter.createCaller(context(42)).condo.save({ revision: 0, state })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("não sobrescreve com uma revisão desatualizada", async () => {
    const { db, updatedValues } = makeDb({ row: savedRow(1) });
    getDbMock.mockResolvedValue(db);
    await expect(
      appRouter.createCaller(context(42)).condo.save({ revision: 0, state })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updatedValues).toHaveLength(0);
  });

  it("faz update quando a revisão esperada coincide", async () => {
    const { db, updatedValues } = makeDb({ row: savedRow(4) });
    getDbMock.mockResolvedValue(db);
    const result = await appRouter
      .createCaller(context(42))
      .condo.save({ revision: 4, state });
    expect(result).toEqual({ state, revision: 5 });
    expect(updatedValues).toHaveLength(1);
  });

  it("retorna CONFLICT quando o update não afeta exatamente uma linha", async () => {
    getDbMock.mockResolvedValue(
      makeDb({ row: savedRow(4), affectedRows: 0 }).db
    );
    await expect(
      appRouter.createCaller(context(42)).condo.save({ revision: 4, state })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejeita leitura atual menor que a anterior", async () => {
    getDbMock.mockResolvedValue(makeDb({ row: savedRow(1) }).db);
    const bad: CondoState = {
      ...state,
      months: [
        {
          ...closedMonth,
          status: "open",
          readings: [
            { ...closedMonth.readings[0]!, waterCurrent: 0, waterPrevious: 10 },
          ],
        },
      ],
    };
    await expect(
      appRouter
        .createCaller(context(42))
        .condo.save({ revision: 1, state: bad })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("não usa o estado inicial quando o banco está indisponível", async () => {
    getDbMock.mockResolvedValue(null);
    await expect(
      appRouter.createCaller(context(42)).condo.get()
    ).rejects.toThrow("Database is not available");
  });

  it("mês fechado só pode ser reaberto, sem mudar lançamentos junto", () => {
    const closedState: CondoState = { ...state, months: [closedMonth] };
    const reopened: CondoState = {
      ...state,
      months: [{ ...closedMonth, status: "open" }],
    };
    expect(() =>
      validateClosedCompetenceChanges(closedState, reopened)
    ).not.toThrow();
    expect(() =>
      validateClosedCompetenceChanges(closedState, {
        ...state,
        months: [{ ...closedMonth, feeCents: 100 }],
      })
    ).toThrow(/fechado/);
    expect(() =>
      validateClosedCompetenceChanges(closedState, { ...state, months: [] })
    ).toThrow(/fechado/);
  });

  it("lê o formato antigo salvo no banco", () => {
    const legacy = {
      name: "Condomínio San Gimignano",
      units: [
        { id: "u1", number: "101", resident: "", fraction: 0, active: true },
      ],
      months: [],
    };
    expect(parseState(JSON.stringify(legacy))).toEqual({
      name: "Condomínio San Gimignano",
      openingBalanceCents: 0,
      openingDate: null,
      openingReserveCents: 0,
      tariffs: emptyTariffs,
      units: [
        { id: "u1", number: "101", resident: "", active: true, exempt: false },
      ],
      months: [],
    });
  });
});

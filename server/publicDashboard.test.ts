import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, type CondoState } from "@shared/condo";
import { DEFAULT_PUBLIC_CONDO_NAME } from "./condo-config";
import { getPublicDashboard, toPublicDashboard } from "./publicDashboard";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

function makeDb(rows: unknown[]) {
  const query: any = {
    from: vi.fn(() => query),
    limit: vi.fn(async () => rows),
  };
  return { select: vi.fn(() => query) };
}

function fixtureState(): CondoState {
  return {
    name: "Condomínio Público",
    units: [
      {
        id: "u1",
        number: "101",
        resident: "Morador privado",
        fraction: 50,
        active: true,
      },
      {
        id: "u2",
        number: "102",
        resident: "Outro privado",
        fraction: 50,
        active: false,
      },
    ],
    months: [
      {
        id: "m-old",
        competence: "2025-12",
        status: "closed",
        waterRateCents: 100,
        gasRateCents: 100,
        openingBalanceCents: 0,
        charges: [],
        expenses: [
          {
            id: "old-expense",
            description: "Despesa antiga",
            category: "Limpeza",
            date: "2025-12-10",
            amountCents: 1,
          },
        ],
      },
      {
        id: "m-latest",
        competence: "2026-02",
        status: "open",
        waterRateCents: 100,
        gasRateCents: 100,
        openingBalanceCents: 0,
        charges: [
          {
            unitId: "u1",
            waterPrevious: 1,
            waterCurrent: 2,
            gasPrevious: 3,
            gasCurrent: 4,
            condoCents: 9,
            reserveCents: 8,
            fineCents: 7,
            otherCents: 6,
            paidCents: 5,
            notes: "nota privada",
          },
        ],
        expenses: [
          {
            id: "expense-1",
            description: "Conta de água",
            category: "Água",
            date: "2026-02-10",
            amountCents: 1200,
            rateable: true,
          },
          {
            id: "expense-2",
            description: "Serviço de limpeza",
            category: "Limpeza",
            date: "2026-02-11",
            amountCents: 800,
          },
        ],
      },
    ],
  };
}

describe("dashboard público", () => {
  beforeEach(() => getDbMock.mockReset());

  it("escolhe a competência lexicograficamente mais recente e redige PII/financeiro privado", () => {
    const result = toPublicDashboard(fixtureState());

    expect(result).toEqual({
      name: "Condomínio Público",
      apartmentCount: 1,
      latest: {
        competence: "2026-02",
        status: "open",
        totalExpensesCents: 2000,
        expenses: [
          {
            id: "expense-1",
            description: "Conta de água",
            category: "Água",
            date: "2026-02-10",
            amountCents: 1200,
          },
          {
            id: "expense-2",
            description: "Serviço de limpeza",
            category: "Limpeza",
            date: "2026-02-11",
            amountCents: 800,
          },
        ],
        categories: [
          { category: "Água", amountCents: 1200 },
          { category: "Limpeza", amountCents: 800 },
        ],
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Morador privado");
    expect(serialized).not.toContain("nota privada");
    expect(serialized).not.toContain("u1");
    expect(serialized).not.toContain("fineCents");
    expect(serialized).not.toContain("paidCents");
  });

  it("retorna latest null para zero competências", () => {
    expect(
      toPublicDashboard({ ...initialState, name: "Vazio", units: [] })
    ).toEqual({
      name: "Vazio",
      apartmentCount: 0,
      latest: null,
    });
  });

  it("usa o único condo_states configurado", async () => {
    getDbMock.mockResolvedValue(
      makeDb([{ ownerId: 77, state: fixtureState(), revision: 4 }])
    );

    await expect(getPublicDashboard()).resolves.toMatchObject({
      name: "Condomínio Público",
      apartmentCount: 1,
      latest: { competence: "2026-02" },
    });
  });

  it("usa o nome público padrão vazio sem inventar owner ou apartamentos", async () => {
    getDbMock.mockResolvedValue(makeDb([]));

    await expect(getPublicDashboard()).resolves.toEqual({
      name: DEFAULT_PUBLIC_CONDO_NAME,
      apartmentCount: 0,
      latest: null,
    });
  });

  it("falha fechado quando há mais de um condo configurado", async () => {
    getDbMock.mockResolvedValue(
      makeDb([
        { ownerId: 1, state: fixtureState(), revision: 1 },
        { ownerId: 2, state: fixtureState(), revision: 1 },
      ])
    );

    await expect(getPublicDashboard()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

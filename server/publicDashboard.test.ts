import { beforeEach, describe, expect, it, vi } from "vitest";
import { condoStateSchema, initialState, type CondoState } from "@shared/condo";
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
  const month = (
    id: string,
    competence: string,
    status: "open" | "closed",
    payments: CondoState["months"][number]["payments"]
  ) => ({
    id,
    competence,
    status,
    feeCents: 500,
    waterPriceCents: 1000,
    readings: [
      {
        unitId: "u1",
        waterPrevious: 0,
        waterCurrent: 3000,
        gasPrevious: 0,
        gasCurrent: 0,
      },
      {
        unitId: "u2",
        waterPrevious: 0,
        waterCurrent: 1000,
        gasPrevious: 0,
        gasCurrent: 0,
      },
    ],
    expenses: [
      {
        id: `${id}-agua`,
        description: "Conta Copasa",
        category: "Água",
        amountCents: 4000,
      },
      {
        id: `${id}-limpeza`,
        description: "Faxina",
        category: "Limpeza",
        amountCents: 1000,
      },
    ],
    payments,
    bankBalanceCents: 123,
  });
  return condoStateSchema.parse({
    name: "Condomínio Público",
    openingBalanceCents: 10000,
    units: [
      { id: "u1", number: "101", resident: "Morador privado", active: true },
      { id: "u2", number: "102", resident: "Outro privado", active: true },
    ],
    months: [
      month("m-old", "2026-01", "closed", [
        { unitId: "u1", amountCents: 3500 },
      ]),
      month("m-new", "2026-02", "open", []),
    ],
  });
}

describe("quadro público", () => {
  beforeEach(() => getDbMock.mockReset());

  it("mostra o mês mais recente com a cota de cada apartamento e o caixa", () => {
    const result = toPublicDashboard(fixtureState());
    expect(result.competences).toEqual(["2026-02", "2026-01"]);
    expect(result.month?.competence).toBe("2026-02");
    expect(result.month?.quotas).toEqual([
      {
        number: "101",
        exempt: false,
        waterMilli: 3000,
        gasMilli: 0,
        waterCents: 3000,
        gasCents: 0,
        feeCents: 500,
        maintenanceCents: 0,
        reserveCents: 0,
        adminCents: 0,
        extraCents: 0,
        totalCents: 3500,
      },
      {
        number: "102",
        exempt: false,
        waterMilli: 1000,
        gasMilli: 0,
        waterCents: 1000,
        gasCents: 0,
        feeCents: 500,
        maintenanceCents: 0,
        reserveCents: 0,
        adminCents: 0,
        extraCents: 0,
        totalCents: 1500,
      },
    ]);
    expect(result.month?.cash).toEqual({
      openingCents: 10000 + 3500 - 5000,
      receivedCents: 0,
      expensesCents: 5000,
      closingCents: 10000 + 3500 - 5000 - 5000,
      condoOpeningCents: 10000 + 3500 - 5000,
      condoClosingCents: 10000 + 3500 - 5000 - 5000,
      reserveOpeningCents: 0,
      reserveInCents: 0,
      reserveOutCents: 0,
      reserveClosingCents: 0,
    });
    expect(result.month?.categories).toEqual([
      { category: "Água", amountCents: 4000 },
      { category: "Limpeza", amountCents: 1000 },
    ]);
  });

  it("abre um mês anterior quando pedido", () => {
    const result = toPublicDashboard(fixtureState(), "2026-01");
    expect(result.month?.competence).toBe("2026-01");
    expect(result.month?.cash.receivedCents).toBe(3500);
  });

  it("não expõe moradores, ids, pagamentos por apto nem extrato", () => {
    const serialized = JSON.stringify(toPublicDashboard(fixtureState()));
    for (const hidden of [
      "Morador privado",
      "Outro privado",
      "u1",
      "u2",
      "paidCents",
      "balanceCents",
      "bankBalanceCents",
      "previousCents",
    ])
      expect(serialized).not.toContain(hidden);
  });

  it("retorna mês nulo quando nada foi lançado", () => {
    expect(toPublicDashboard({ ...initialState, name: "Vazio" })).toEqual({
      name: "Vazio",
      apartmentCount: 0,
      competences: [],
      month: null,
    });
  });

  it("usa o único condomínio configurado", async () => {
    getDbMock.mockResolvedValue(
      makeDb([{ ownerId: 77, state: fixtureState(), revision: 4 }])
    );
    await expect(getPublicDashboard()).resolves.toMatchObject({
      name: "Condomínio Público",
      apartmentCount: 2,
      month: { competence: "2026-02" },
    });
  });

  it("usa o nome padrão quando o banco está vazio", async () => {
    getDbMock.mockResolvedValue(makeDb([]));
    await expect(getPublicDashboard()).resolves.toEqual({
      name: DEFAULT_PUBLIC_CONDO_NAME,
      apartmentCount: 0,
      competences: [],
      month: null,
    });
  });

  it("falha fechado quando há mais de um condomínio", async () => {
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

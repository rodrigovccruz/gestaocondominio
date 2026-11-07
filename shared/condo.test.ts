import { describe, expect, it } from "vitest";
import {
  calculateCharge,
  calculateMonth,
  condoStateSchema,
  initialState,
  newMonthlyCharge,
  emptyCharge,
  expenseSchema,
  attachUnitSnapshots,
  resolveChargeUnit,
  type Month,
} from "./condo";

const baseMonth: Month = {
  id: "month-2026-01",
  competence: "2026-01",
  status: "open",
  waterRateCents: 250,
  gasRateCents: 400,
  openingBalanceCents: 10_000,
  charges: [],
  expenses: [],
};

describe("contrato e cálculos do condomínio", () => {
  it("rejeita datas inexistentes e aceita ano bissexto", () => {
    const expense = {
      id: "e",
      description: "Limpeza",
      category: "Limpeza",
      amountCents: 100,
    };
    expect(
      expenseSchema.safeParse({ ...expense, date: "2026-02-31" }).success
    ).toBe(false);
    expect(
      expenseSchema.safeParse({ ...expense, date: "2024-02-29" }).success
    ).toBe(true);
  });
  it("preserva número e morador do lançamento ao atualizar o cadastro", () => {
    const original = attachUnitSnapshots({
      ...initialState,
      units: [
        {
          id: "u",
          number: "101",
          resident: "Morador anterior",
          fraction: 10,
          active: true,
        },
      ],
      months: [{ ...baseMonth, charges: [emptyCharge("u")] }],
    });
    const updated = attachUnitSnapshots({
      ...original,
      units: [
        { ...original.units[0], number: "201", resident: "Novo morador" },
      ],
    });
    expect(
      resolveChargeUnit(updated, updated.months[0].charges[0])
    ).toMatchObject({ number: "101", resident: "Morador anterior" });
  });

  it("abre um mês novo sem copiar pagamentos, multas ou adicionais", () => {
    const prior = {
      ...emptyCharge("unit-1"),
      waterCurrent: 1234,
      gasCurrent: 456,
      condoCents: 12000,
      reserveCents: 1500,
      paidCents: 15000,
      fineCents: 500,
      otherCents: 300,
      notes: "acordo anterior",
    };
    expect(newMonthlyCharge("unit-1", prior, true)).toMatchObject({
      waterPrevious: 1234,
      waterCurrent: 1234,
      gasPrevious: 456,
      gasCurrent: 456,
      condoCents: 12000,
      reserveCents: 1500,
      paidCents: 0,
      fineCents: 0,
      otherCents: 0,
      notes: "",
    });
    expect(newMonthlyCharge("unit-1", prior, false).condoCents).toBe(0);
  });

  it("calcula consumo em milésimos e valores monetários em centavos", () => {
    const charge = {
      unitId: "unit-1",
      waterPrevious: 1_000,
      waterCurrent: 2_500,
      gasPrevious: 100,
      gasCurrent: 600,
      condoCents: 1_000,
      reserveCents: 250,
      fineCents: 0,
      otherCents: 50,
      paidCents: 500,
      notes: "",
    };

    expect(calculateCharge(charge, baseMonth)).toEqual({
      waterMilli: 1_500,
      gasMilli: 500,
      waterCents: 375,
      gasCents: 200,
      sharedCents: 0,
      totalCents: 1_875,
      outstandingCents: 1_375,
    });
  });

  it("mantém débito e crédito por unidade sem compensação indevida", () => {
    const month: Month = {
      ...baseMonth,
      charges: [
        {
          unitId: "unit-1",
          waterPrevious: 0,
          waterCurrent: 0,
          gasPrevious: 0,
          gasCurrent: 0,
          condoCents: 100,
          reserveCents: 0,
          fineCents: 0,
          otherCents: 0,
          paidCents: 0,
          notes: "",
        },
        {
          unitId: "unit-2",
          waterPrevious: 0,
          waterCurrent: 0,
          gasPrevious: 0,
          gasCurrent: 0,
          condoCents: 100,
          reserveCents: 0,
          fineCents: 0,
          otherCents: 0,
          paidCents: 150,
          notes: "",
        },
      ],
    };

    expect(calculateMonth(month)).toMatchObject({
      billedCents: 200,
      receivedCents: 150,
      outstandingCents: 100,
      creditCents: 50,
    });
  });

  it("aceita o estado inicial e rejeita leituras incompatíveis", () => {
    expect(condoStateSchema.safeParse(initialState).success).toBe(true);
    expect(
      condoStateSchema.safeParse({
        ...initialState,
        units: [
          {
            id: "unit-1",
            number: "1",
            resident: "",
            fraction: 100,
            active: true,
          },
        ],
        months: [
          {
            ...baseMonth,
            charges: [
              {
                unitId: "unit-1",
                waterPrevious: 10,
                waterCurrent: 9,
                gasPrevious: 0,
                gasCurrent: 0,
                condoCents: 0,
                reserveCents: 0,
                fineCents: 0,
                otherCents: 0,
                paidCents: 0,
                notes: "",
              },
            ],
          },
        ],
      }).success
    ).toBe(false);
  });
});

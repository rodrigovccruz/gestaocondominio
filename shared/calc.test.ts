import { describe, expect, it } from "vitest";
import type { CondoState, Month } from "./condo";
import { buildReports, calculateQuotas, newMonth, splitCents } from "./calc";
import { upgradeState } from "./upgrade";

const units = [
  "101",
  "102",
  "201",
  "202",
  "301",
  "302",
  "401",
  "402",
  "501",
  "502",
].map((number, i) => ({ id: `u${9 - i}`, number, resident: "", active: true }));

function month(over: Partial<Month> = {}): Month {
  return {
    id: "m1",
    competence: "2026-10",
    status: "open",
    reservePerUnitCents: 0,
    readings: units.map((u, i) => ({
      unitId: u.id,
      waterPrevious: 1000,
      waterCurrent: 1000 + (i + 1) * 1000, // 1 a 10 m³
      gasPrevious: 0,
      gasCurrent: i < 5 ? 500 : 0, // só os 5 primeiros usam gás
    })),
    expenses: [],
    payments: [],
    bankBalanceCents: null,
    ...over,
  };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("divisão em centavos", () => {
  it("preserva todos os centavos e desempata pela ordem dos apartamentos", () => {
    const parts = splitCents(
      10001,
      units.map(u => ({ key: u.id, weight: 1 }))
    );
    expect(sum(Object.values(parts))).toBe(10001);
    expect(parts[units[0].id]).toBe(1001);
    expect(parts[units[9].id]).toBe(1000);
  });

  it("consumo zero não paga; todos zero divide igual", () => {
    expect(
      splitCents(300, [
        { key: "a", weight: 0 },
        { key: "b", weight: 1 },
        { key: "c", weight: 2 },
      ])
    ).toEqual({ a: 0, b: 100, c: 200 });
    expect(
      splitCents(300, [
        { key: "a", weight: 0 },
        { key: "b", weight: 0 },
        { key: "c", weight: 0 },
      ])
    ).toEqual({ a: 100, b: 100, c: 100 });
  });
});

describe("cota do mês", () => {
  it("água e gás pelo consumo, resto igual, soma igual às despesas", () => {
    const m = month({
      reservePerUnitCents: 2000,
      expenses: [
        {
          id: "e1",
          description: "Copasa",
          category: "Água",
          amountCents: 55000,
        },
        { id: "e2", description: "Gás", category: "Gás", amountCents: 12345 },
        {
          id: "e3",
          description: "Faxina",
          category: "Limpeza",
          amountCents: 40000,
        },
        {
          id: "e4",
          description: "Lâmpadas",
          category: "Manutenção",
          amountCents: 3333,
        },
      ],
    });
    const { quotas, totals } = calculateQuotas(m, units);
    expect(quotas.map(q => q.number)).toEqual(units.map(u => u.number));
    // 55 m³ no total: R$ 10,00 por m³
    expect(quotas.map(q => q.waterCents)).toEqual([
      1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
    ]);
    expect(quotas.slice(5).every(q => q.gasCents === 0)).toBe(true);
    expect(sum(quotas.map(q => q.gasCents))).toBe(12345);
    expect(sum(quotas.map(q => q.commonCents))).toBe(43333);
    expect(totals.expensesCents).toBe(55000 + 12345 + 43333);
    expect(totals.quotasCents).toBe(totals.expensesCents + 10 * 2000);
  });
});

describe("encadeamento entre meses", () => {
  it("leva o saldo do caixa e o débito de quem não pagou", () => {
    const oct = month({
      expenses: [
        {
          id: "e1",
          description: "Faxina",
          category: "Limpeza",
          amountCents: 100000,
        },
      ],
      payments: units.slice(1).map(u => ({ unitId: u.id, amountCents: 10000 })), // 101 não pagou
      bankBalanceCents: 40000,
    });
    const state: CondoState = {
      name: "X",
      openingBalanceCents: 50000,
      units,
      months: [oct],
    };
    const nov = newMonth(state, "2026-11", "m2");
    expect(nov.readings[0].waterPrevious).toBe(oct.readings[0].waterCurrent);
    nov.expenses = [
      {
        id: "e9",
        description: "Faxina",
        category: "Limpeza",
        amountCents: 100000,
      },
    ];
    nov.payments = [{ unitId: units[0].id, amountCents: 20000 }]; // 101 paga outubro e novembro

    const [r1, r2] = buildReports({ ...state, months: [nov, oct] });
    expect(r1.month.competence).toBe("2026-10");
    expect(r1.cash.closingCents).toBe(40000);
    expect(r1.cash.differenceCents).toBe(0);
    expect(r1.statements[0].balanceCents).toBe(10000);
    expect(r2.cash.openingCents).toBe(40000);
    expect(r2.statements[0]).toMatchObject({
      previousCents: 10000,
      dueCents: 20000,
      balanceCents: 0,
    });
    expect(r2.statements[1].balanceCents).toBe(10000);
    expect(r2.cash.closingCents).toBe(40000 + 20000 - 100000);
    expect(r2.cash.differenceCents).toBeNull();
  });

  it("apartamento fora do mês continua aparecendo enquanto tiver saldo", () => {
    const oct = month({
      readings: [month().readings[0]],
      expenses: [
        { id: "e", description: "x", category: "Outros", amountCents: 500 },
      ],
    });
    const nov = month({ id: "m2", competence: "2026-11", readings: [] });
    const reports = buildReports({
      name: "X",
      openingBalanceCents: 0,
      units,
      months: [oct, nov],
    });
    expect(reports[1].statements).toHaveLength(1);
    expect(reports[1].statements[0].previousCents).toBe(500);
  });
});

describe("formato antigo", () => {
  it("converte o estado atual de produção (só apartamentos)", () => {
    const up = upgradeState({
      name: "Condomínio San Gimignano",
      units: [
        { id: "a", number: "101", resident: "", fraction: 0, active: true },
      ],
      months: [],
    }) as CondoState;
    expect(up.openingBalanceCents).toBe(0);
    expect(up.months).toEqual([]);
  });

  it("converte cobranças antigas em leituras e pagamentos", () => {
    const up = upgradeState({
      name: "X",
      units: [
        { id: "a", number: "101", resident: "", fraction: 0, active: true },
      ],
      months: [
        {
          id: "m",
          competence: "2026-09",
          status: "closed",
          waterRateCents: 900,
          gasRateCents: 0,
          openingBalanceCents: 1234,
          charges: [
            {
              unitId: "a",
              waterPrevious: 1,
              waterCurrent: 2,
              gasPrevious: 3,
              gasCurrent: 4,
              condoCents: 0,
              reserveCents: 0,
              fineCents: 0,
              otherCents: 0,
              paidCents: 700,
              notes: "",
            },
          ],
          expenses: [
            {
              id: "e",
              description: "Copasa",
              category: "Água",
              date: "2026-09-10",
              amountCents: 700,
              rateable: false,
            },
          ],
        },
      ],
    }) as CondoState;
    expect(up.openingBalanceCents).toBe(1234);
    expect(up.months[0].readings[0]).toEqual({
      unitId: "a",
      waterPrevious: 1,
      waterCurrent: 2,
      gasPrevious: 3,
      gasCurrent: 4,
    });
    expect(up.months[0].payments).toEqual([{ unitId: "a", amountCents: 700 }]);
    expect(upgradeState(up)).toBe(up);
  });
});

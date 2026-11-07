import { describe, expect, it } from "vitest";
import {
  allocateCents,
  calculateExpenseAllocation,
  makeAllocationConfig,
  allocationConfigurationChanged,
} from "./rateio";
import {
  calculateCharge,
  calculateMonth,
  condoStateSchema,
  emptyCharge,
  initialState,
  type CondoState,
  type Month,
} from "./condo";

const numbers = [
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
];
const state: CondoState = {
  ...initialState,
  units: numbers.map(number => ({
    id: number,
    number,
    resident: "",
    active: true,
    fraction: 0,
  })),
  months: [],
};
const month: Month = {
  id: "m",
  competence: "2026-11",
  status: "open",
  waterRateCents: 497,
  gasRateCents: 2363,
  openingBalanceCents: 0,
  charges: state.units.map(unit => emptyCharge(unit.id)),
  expenses: [
    {
      id: "e",
      description: "Limpeza",
      category: "Limpeza",
      date: "2026-11-01",
      amountCents: 10001,
      rateable: true,
    },
  ],
};

describe("rateio exato de despesas", () => {
  it("distribui todos os centavos entre dez apartamentos sem perder o resto", () => {
    const shares = allocateCents(
      10001,
      state.units.map(unit => ({ unitId: unit.id, weight: 1 }))
    );
    expect(Object.values(shares).reduce((sum, value) => sum + value, 0)).toBe(
      10001
    );
    expect(shares["101"]).toBe(1001);
    expect(shares["502"]).toBe(1000);
  });
  it("desempata pelo ID independentemente da ordem enviada", () => {
    const weights = [
      { unitId: "b", weight: 1 },
      { unitId: "a", weight: 1 },
      { unitId: "c", weight: 1 },
    ];
    expect(allocateCents(2, weights)).toEqual({ a: 1, b: 1, c: 0 });
    expect(allocateCents(2, [...weights].reverse())).toEqual({
      a: 1,
      b: 1,
      c: 0,
    });
  });
  it("distribui por fração ideal e mantém pesos congelados por competência", () => {
    const fractional = {
      ...state,
      units: state.units.map((unit, index) => ({
        ...unit,
        fraction: index === 0 ? 55 : 5,
      })),
    };
    const config = makeAllocationConfig(fractional, "fraction");
    const configured = { ...month, allocation: config };
    expect(calculateExpenseAllocation(configured).byUnit["101"]).toBe(5501);
    expect(allocationConfigurationChanged(fractional, configured)).toBe(false);
    const modified = {
      ...fractional,
      units: fractional.units.map((unit, index) => ({
        ...unit,
        fraction: index === 0 ? 50 : index === 1 ? 10 : 5,
      })),
    };
    expect(allocationConfigurationChanged(modified, configured)).toBe(true);
    expect(calculateExpenseAllocation(configured).byUnit["101"]).toBe(5501);
  });
  it("bloqueia frações vazias e totais diferentes de 100%", () => {
    expect(() => makeAllocationConfig(state, "fraction")).toThrow(/positiva/);
    expect(() =>
      makeAllocationConfig(
        {
          ...state,
          units: state.units.map(unit => ({ ...unit, fraction: 5 })),
        },
        "fraction"
      )
    ).toThrow(/100%/);
  });
  it("só inclui despesas marcadas e continua compatível com competências legadas", () => {
    const configured = {
      ...month,
      allocation: makeAllocationConfig(state, "equal"),
      expenses: [
        ...month.expenses,
        {
          id: "gas",
          description: "Conta gás",
          category: "Gás" as const,
          date: "2026-11-01",
          amountCents: 50000,
        },
      ],
    };
    expect(calculateExpenseAllocation(month).totalCents).toBe(0);
    expect(calculateExpenseAllocation(configured).totalCents).toBe(10001);
    expect(
      calculateExpenseAllocation({
        ...configured,
        expenses: configured.expenses.map(expense => ({
          ...expense,
          rateable: false,
        })),
      }).totalCents
    ).toBe(0);
  });
  it("inclui o rateio separadamente sem sobrescrever consumo, cota manual ou pagamentos", () => {
    const charge = {
      ...emptyCharge("101"),
      waterCurrent: 1000,
      gasCurrent: 1000,
      condoCents: 5000,
      reserveCents: 1000,
      fineCents: 50,
      otherCents: 25,
      paidCents: 100,
    };
    const configured = {
      ...month,
      allocation: makeAllocationConfig(state, "equal"),
      charges: [charge, ...month.charges.slice(1)],
    };
    const computed = calculateCharge(charge, configured);
    expect(computed.sharedCents).toBe(1001);
    expect(computed.totalCents).toBe(497 + 2363 + 1001 + 5000 + 1000 + 50 + 25);
    expect(charge.paidCents).toBe(100);
    expect(calculateMonth(configured).allocatedCents).toBe(10001);
  });
  it("valida vínculos dos participantes e rejeita pesos ou IDs duplicados", () => {
    const configured = {
      ...month,
      allocation: makeAllocationConfig(state, "equal"),
    };
    expect(
      condoStateSchema.safeParse({ ...state, months: [configured] }).success
    ).toBe(true);
    expect(
      condoStateSchema.safeParse({
        ...state,
        months: [{ ...configured, charges: [] }],
      }).success
    ).toBe(false);
    expect(() => allocateCents(100, [{ unitId: "u", weight: 0 }])).toThrow();
    expect(() =>
      allocateCents(100, [
        { unitId: "u", weight: 1 },
        { unitId: "u", weight: 1 },
      ])
    ).toThrow();
  });
  it("conserva o total para diferentes valores e distribuições", () => {
    for (const amount of [0, 1, 2, 9, 10, 101, 99999, 100000000]) {
      for (const weights of [
        [1, 1, 1],
        [5, 15, 80],
        [11, 17, 23, 49],
      ]) {
        const shares = allocateCents(
          amount,
          weights.map((weight, index) => ({ unitId: String(index), weight }))
        );
        expect(
          Object.values(shares).reduce((sum, value) => sum + value, 0)
        ).toBe(amount);
        expect(
          Object.values(shares).every(
            value => Number.isSafeInteger(value) && value >= 0
          )
        ).toBe(true);
      }
    }
  });
});

describe("participantes escolhidos", () => {
  it("permite excluir unidades ativas no método igual", () => {
    const config = makeAllocationConfig(state, "equal", ["101", "502"]);
    const result = calculateExpenseAllocation({ ...month, allocation: config });
    expect(config.participants.map(p => p.unitId)).toEqual(["101", "502"]);
    expect(
      Object.values(result.byUnit).reduce((sum, cents) => sum + cents, 0)
    ).toBe(10001);
    expect(result.byUnit["102"]).toBeUndefined();
  });
  it("normaliza frações ao conjunto selecionado e conserva 100% da distribuição", () => {
    const fractions = {
      ...state,
      units: state.units.map((unit, index) => ({
        ...unit,
        fraction: index === 0 ? 55 : 5,
      })),
    };
    const config = makeAllocationConfig(fractions, "fraction", ["101", "102"]);
    expect(config.participants.reduce((sum, p) => sum + p.weight, 0)).toBe(
      100000
    );
    expect(config.participants).toHaveLength(2);
    const result = calculateExpenseAllocation({ ...month, allocation: config });
    expect(
      Object.values(result.byUnit).reduce((sum, cents) => sum + cents, 0)
    ).toBe(10001);
    expect(
      allocationConfigurationChanged(fractions, {
        ...month,
        allocation: config,
      })
    ).toBe(false);
  });
  it("rejeita seleção vazia, duplicada ou de unidade inexistente", () => {
    expect(() => makeAllocationConfig(state, "equal", [])).toThrow(/Selecione/);
    expect(() => makeAllocationConfig(state, "equal", ["101", "101"])).toThrow(
      /Selecione/
    );
    expect(() => makeAllocationConfig(state, "equal", ["inexistente"])).toThrow(
      /Selecione/
    );
  });
});

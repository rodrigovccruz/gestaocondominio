import { describe, expect, it } from "vitest";
import { validateAllocationChanges } from "./condo";
import {
  condoStateSchema,
  emptyCharge,
  initialState,
  type CondoState,
  type Month,
} from "../shared/condo";
import { makeAllocationConfig } from "../shared/rateio";
const state: CondoState = {
  ...initialState,
  units: [
    { id: "a", number: "101", resident: "", fraction: 75, active: true },
    { id: "b", number: "102", resident: "", fraction: 25, active: true },
  ],
};
const month: Month = {
  id: "m",
  competence: "2026-11",
  status: "open",
  waterRateCents: 0,
  gasRateCents: 0,
  openingBalanceCents: 0,
  charges: [emptyCharge("a"), emptyCharge("b")],
  expenses: [],
  allocation: makeAllocationConfig(state, "fraction"),
};

describe("configuração de rateio no servidor", () => {
  it("rejeita frações cuja soma é inválida mesmo em payload direto", () => {
    const invalid = {
      ...state,
      months: [
        {
          ...month,
          allocation: {
            method: "fraction",
            participants: [{ unitId: "a", weight: 1 }],
          },
        },
      ],
    };
    expect(condoStateSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejeita pesos arbitrários que somam100 mas não correspondem ao cadastro", () => {
    const invalid: CondoState = {
      ...state,
      months: [
        {
          ...month,
          allocation: {
            method: "fraction",
            participants: [
              { unitId: "a", weight: 50000 },
              { unitId: "b", weight: 50000 },
            ],
          },
        },
      ],
    };
    expect(() => validateAllocationChanges(undefined, invalid)).toThrow(
      /corresponder/
    );
  });
  it("aceita a configuração derivada das unidades selecionadas", () => {
    const configured = {
      ...state,
      months: [
        {
          ...month,
          allocation: makeAllocationConfig(state, "fraction", ["b"]),
        },
      ],
    };
    expect(() =>
      validateAllocationChanges(undefined, configured)
    ).not.toThrow();
    expect(configured.months[0].allocation.participants).toEqual([
      { unitId: "b", weight: 100000 },
    ]);
  });
  it("preserva pesos anteriores após edição cadastral sem atualizar o rateio", () => {
    const saved = { ...state, months: [month] };
    const next = {
      ...saved,
      units: saved.units.map(unit => ({ ...unit, fraction: 50 })),
    };
    expect(() => validateAllocationChanges(saved, next)).not.toThrow();
  });
  it("exige participantes ativos ao criar um novo snapshot", () => {
    const inactive = {
      ...state,
      units: state.units.map(unit => ({ ...unit, active: unit.id !== "b" })),
      months: [month],
    };
    expect(() => validateAllocationChanges(undefined, inactive)).toThrow(
      /ativas/
    );
  });
});

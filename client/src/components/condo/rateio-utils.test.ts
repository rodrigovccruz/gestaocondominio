import { describe, expect, it } from "vitest";
import { buildAllocationPreview } from "./rateio-utils";
import {
  calculateMonth,
  emptyCharge,
  initialState,
  type CondoState,
  type Month,
} from "../../../../shared/condo";
import { makeAllocationConfig } from "../../../../shared/rateio";

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
  expenses: [
    {
      id: "e",
      description: "Limpeza",
      category: "Limpeza",
      date: "2026-11-01",
      amountCents: 10000,
      rateable: true,
    },
  ],
  allocation: makeAllocationConfig(state, "equal"),
};

describe("prévia do rateio", () => {
  it("troca a simulação de igual para fração sem alterar o snapshot salvo", () => {
    const preview = buildAllocationPreview(state, month, "fraction");
    expect(preview.config?.method).toBe("fraction");
    expect(preview.hasUnsavedChanges).toBe(true);
    expect(preview.config?.participants[0].weight).toBe(75000);
    expect(month.allocation?.method).toBe("equal");
    expect(calculateMonth(preview.draftMonth).allocatedCents).toBe(10000);
  });
  it("retorna erro em frações inválidas e permite uma nova prévia igual", () => {
    const invalid = {
      ...state,
      units: state.units.map(unit => ({ ...unit, fraction: 0 })),
    };
    expect(buildAllocationPreview(invalid, month, "fraction").error).toMatch(
      /positiva/
    );
    expect(
      buildAllocationPreview(invalid, month, "equal").error
    ).toBeUndefined();
  });
  it("inclui unidades sem cobrança na prévia e mantém todos os centavos", () => {
    const preview = buildAllocationPreview(
      state,
      { ...month, charges: [emptyCharge("a")] },
      "equal"
    );
    expect(preview.draftMonth.charges).toHaveLength(2);
    expect(calculateMonth(preview.draftMonth).allocatedCents).toBe(10000);
  });
  it("mostra os participantes e pesos históricos mesmo após arquivamento", () => {
    const changed = {
      ...state,
      units: state.units.map(unit => ({
        ...unit,
        active: unit.id !== "b",
        fraction: unit.id === "a" ? 100 : 0,
      })),
    };
    const preview = buildAllocationPreview(
      changed,
      { ...month, status: "closed" },
      "fraction",
      true
    );
    expect(preview.config).toEqual(month.allocation);
    expect(preview.units.map(unit => unit.id)).toEqual(["a", "b"]);
    expect(calculateMonth(preview.draftMonth).allocatedCents).toBe(10000);
  });
});

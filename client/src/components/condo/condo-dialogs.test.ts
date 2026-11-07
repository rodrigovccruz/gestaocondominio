import { describe, expect, it } from "vitest";
import {
  initialExpenseRateable,
  rateableAfterExpenseCategoryChange,
} from "./condo-dialogs";

const categories = [
  "Água",
  "Gás",
  "Manutenção",
  "Limpeza",
  "Administração",
  "Outros",
] as const;

describe("opt-in explícito de rateio", () => {
  it("começa desmarcado para despesa nova e legado sem flag", () => {
    for (const category of categories) {
      expect(initialExpenseRateable({ category })).toBe(false);
    }
    expect(initialExpenseRateable()).toBe(false);
    expect(
      initialExpenseRateable({ category: "Manutenção", rateable: true })
    ).toBe(true);
  });

  it("desmarca água e gás em toda troca de categoria", () => {
    expect(rateableAfterExpenseCategoryChange(true, "Água")).toBe(false);
    expect(rateableAfterExpenseCategoryChange(true, "Gás")).toBe(false);
    expect(rateableAfterExpenseCategoryChange(false, "Água")).toBe(false);
  });

  it("não cria opt-in ao trocar para uma categoria comum", () => {
    expect(rateableAfterExpenseCategoryChange(false, "Manutenção")).toBe(false);
    expect(rateableAfterExpenseCategoryChange(true, "Limpeza")).toBe(true);
  });
});

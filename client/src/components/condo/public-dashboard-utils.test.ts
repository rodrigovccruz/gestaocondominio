import { describe, expect, it } from "vitest";
import {
  formatPublicDate,
  latestCompetenceLabel,
  publicStatusLabel,
} from "../../pages/public-dashboard-utils";

describe("public dashboard helpers", () => {
  it("labels the empty public state without inventing a period", () => {
    expect(latestCompetenceLabel(null)).toBe("Nenhuma competência cadastrada");
  });

  it("formats the server competence and status labels", () => {
    expect(
      latestCompetenceLabel({
        competence: "2026-10",
        status: "closed",
        totalExpensesCents: 0,
        expenses: [],
        categories: [],
      })
    ).toBe("Outubro de 2026");
    expect(publicStatusLabel("open")).toBe("Em aberto");
    expect(publicStatusLabel("closed")).toBe("Fechado");
  });

  it("formats date-only values in UTC to avoid local timezone drift", () => {
    expect(formatPublicDate("2026-10-04")).toBe("04/10/2026");
  });
});

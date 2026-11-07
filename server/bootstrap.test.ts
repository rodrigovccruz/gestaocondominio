import { describe, expect, it } from "vitest";
import { condoStateSchema } from "@shared/condo";
import { firstState, parseUnitList } from "./bootstrap";

describe("setup inicial", () => {
  it("lê a lista de apartamentos sem repetidos nem vazios", () => {
    expect(parseUnitList(" 101, 102;201  202,,101 ")).toEqual([
      "101",
      "102",
      "201",
      "202",
    ]);
    expect(parseUnitList(undefined)).toEqual([]);
  });

  it("cria um estado válido com os apartamentos e sem meses", () => {
    const state = firstState("Edifício Teste", ["101", "102"]);
    expect(condoStateSchema.parse(state)).toEqual(state);
    expect(state.name).toBe("Edifício Teste");
    expect(state.units.map(u => u.number)).toEqual(["101", "102"]);
    expect(state.months).toEqual([]);
  });

  it("usa o nome padrão quando CONDO_NAME não vem", () => {
    expect(firstState(undefined, ["101"]).name).toBe(
      "Condomínio San Gimignano"
    );
  });
});

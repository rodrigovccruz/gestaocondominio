import { describe, expect, it } from "vitest";
import {
  parseMoneyInput,
  parseSignedMoneyInput,
  parseReadingInput,
  nextCompetence,
} from "./condo-utils";

describe("entrada de valores do condomínio", () => {
  it("interpreta reais e leituras em português brasileiro", () => {
    expect(parseMoneyInput("1.234,56")).toBe(123456);
    expect(parseMoneyInput("4,97")).toBe(497);
    expect(parseReadingInput("18,353")).toBe(18353);
    expect(parseSignedMoneyInput("-50,20")).toBe(-5020);
  });
  it("rejeita texto, expoentes, hexadecimal, vazios e negativos indevidos", () => {
    for (const value of [
      "",
      "NaN",
      "Infinity",
      "0x10",
      "1e3",
      "1,2,3",
      "R$ 20",
    ]) {
      expect(parseMoneyInput(value)).toBeNull();
      expect(parseReadingInput(value)).toBeNull();
    }
    expect(parseMoneyInput("-1,00")).toBeNull();
    expect(parseReadingInput("-1,000")).toBeNull();
  });
  it("calcula o mês seguinte, inclusive na virada do ano", () => {
    expect(nextCompetence("2026-12")).toBe("2027-01");
    expect(nextCompetence("2026-09")).toBe("2026-10");
  });
});

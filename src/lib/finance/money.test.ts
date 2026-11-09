import { describe, expect, it } from "vitest";
import { formatCents, parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it.each([
    ["1.234,56", ",", 123456],
    ["-12,30", ",", -1230],
    ["12,30-", ",", -1230],
    ["(12.30)", ".", -1230],
    ["1,234.56", ".", 123456],
    ["€ 5", ",", 500],
    ["+3,1", ",", 310],
    ["-1.000 €", ",", -100000],
    ["0,10", ",", 10],
  ] as const)("%s (%s) -> %i", (raw, dec, expected) => {
    expect(parseAmountToCents(raw, dec)).toBe(expected);
  });

  it("acepta números y redondea a céntimos", () => {
    expect(parseAmountToCents(-12.345)).toBe(-1235);
    expect(parseAmountToCents(0.1 + 0.2)).toBe(30);
  });

  it("devuelve null con valores no numéricos", () => {
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents(undefined)).toBeNull();
    expect(parseAmountToCents("1,2,3", ",")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formatea en es-ES", () => {
    expect(formatCents(123456)).toBe("1234,56 €");
    expect(formatCents(1234567)).toBe("12.345,67 €");
    expect(formatCents(-500)).toBe("-5,00 €");
    expect(formatCents(500, "EUR", { signed: true })).toBe("+5,00 €");
  });
});

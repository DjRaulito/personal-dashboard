import { describe, expect, it } from "vitest";
import { categorize, compileRules, suggestPattern, type Rule } from "./rules";

const rule = (p: Partial<Rule> & Pick<Rule, "pattern" | "category_id">): Rule => ({
  id: p.pattern,
  match_type: "contains",
  amount_sign: "any",
  priority: 100,
  ...p,
});

const rules = compileRules([
  rule({ pattern: "UBER", category_id: "taxi", priority: 60, amount_sign: "expense" }),
  rule({ pattern: "UBER EATS", category_id: "delivery", priority: 10, amount_sign: "expense" }),
  rule({ pattern: "DIGI MOBIL", category_id: "movil" }),
  rule({ pattern: "Nómina", category_id: "nomina", amount_sign: "income" }),
  rule({ pattern: "BIZUM DE", category_id: "bizum", match_type: "starts_with" }),
  rule({ pattern: "CAFE", category_id: "cafe", match_type: "equals" }),
]);

describe("motor de reglas", () => {
  it("respeta la prioridad", () => {
    expect(categorize(rules, "COMPRA UBER EATS MADRID", -1500)).toBe("delivery");
    expect(categorize(rules, "UBER *TRIP", -900)).toBe("taxi");
  });

  it("busca palabras completas, sin tildes ni mayúsculas", () => {
    expect(categorize(rules, "digi mobil espana", -1000)).toBe("movil");
    expect(categorize(rules, "DIGITAL OCEAN", -1000)).toBeNull();
    expect(categorize(rules, "TRANSFERENCIA NOMINA OCTUBRE", 150000)).toBe("nomina");
  });

  it("filtra por signo del importe", () => {
    expect(categorize(rules, "NOMINA", -100)).toBeNull();
    expect(categorize(rules, "UBER", 900)).toBeNull();
  });

  it("starts_with y equals", () => {
    expect(categorize(rules, "Bizum de Ana", 2000)).toBe("bizum");
    expect(categorize(rules, "PAGO BIZUM DE ANA", 2000)).toBeNull();
    expect(categorize(rules, "café", -150)).toBe("cafe");
    expect(categorize(rules, "CAFE BAR", -150)).toBeNull();
  });
});

describe("suggestPattern", () => {
  it("quita prefijos y números de tarjeta", () => {
    expect(suggestPattern("COMPRA TARJETA 4567XXXX1234 MERCADONA VALENCIA")).toBe("MERCADONA VALENCIA");
    expect(suggestPattern("Recibo Netflix.com")).toBe("NETFLIX.COM");
  });
});

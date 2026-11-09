import { describe, expect, it } from "vitest";
import { parseFrankfurter } from "./fx";
import { currencyFactor, investingToYahoo, parseChart } from "./yahoo";

describe("símbolos de Investing a Yahoo", () => {
  it.each([
    ["CALM.O", "NASDAQ", "CALM"],
    ["OKLO.K", "NYSE", "OKLO"],
    ["SN", "NYSE", "SN"],
    ["OHLA", "BME", "OHLA.MC"],
    ["NXTE.MC", "BME", "NXTE.MC"],
    ["KWSG.DE", "ETR", "KWS.DE"],
    ["HLUNb.CO", "CSE", "HLUN-B.CO"],
    ["TLW.L", "LON", "TLW.L"],
  ])("%s (%s) -> %s", (s, m, y) => expect(investingToYahoo(s, m)).toBe(y));

  it("los fondos se buscan por ISIN", () => {
    expect(investingToYahoo("LP68627290", "LU")).toBeNull();
    expect(investingToYahoo("0P0000TOUY", "LU")).toBeNull();
  });
});

describe("respuesta de Yahoo", () => {
  it("cierres diarios sin nulos", () => {
    const json = {
      chart: {
        result: [
          {
            meta: { currency: "EUR" },
            timestamp: [1762329600, 1762416000, 1762502400],
            indicators: { quote: [{ close: [10.5, null, 11] }] },
          },
        ],
      },
    };
    expect(parseChart(json)).toEqual({
      currency: "EUR",
      points: [
        { date: "2025-11-05", value: 10.5 },
        { date: "2025-11-07", value: 11 },
      ],
    });
  });

  it("sin datos", () => {
    expect(parseChart({ chart: { result: null } }).points).toEqual([]);
  });

  it("peniques y monedas incompatibles", () => {
    expect(currencyFactor("GBp", "GBP")).toBe(0.01);
    expect(currencyFactor("EUR", "EUR")).toBe(1);
    expect(currencyFactor("USD", "EUR")).toBeNull();
  });
});

describe("Frankfurter", () => {
  it("euros por unidad", () => {
    const fx = parseFrankfurter({ rates: { "2025-01-02": { USD: 1.25, GBP: 0.8 } } });
    expect(fx.get("USD")).toEqual([{ date: "2025-01-02", value: 0.8 }]);
    expect(fx.get("GBP")![0].value).toBeCloseTo(1.25);
  });
});

describe("Morningstar", async () => {
  const { parseMorningstarSearch, parseMorningstarSeries } = await import("./morningstar");
  it("búsqueda", () => {
    const text = 'Fondo X EUR|{"i":"F000015MMA","n":"Fondo X EUR","t":2}|FONDO\nbasura';
    expect(parseMorningstarSearch(text)).toEqual([{ id: "F000015MMA", name: "Fondo X EUR" }]);
  });
  it("serie", () => {
    expect(parseMorningstarSeries([[Date.UTC(2026, 0, 2), 10.5]]).points).toEqual([
      { date: "2026-01-02", value: 10.5 },
    ]);
  });
});

describe("Morningstar screener", async () => {
  const { parseMorningstarScreener } = await import("./morningstar");
  it("filas", () => {
    expect(parseMorningstarScreener({ rows: [{ SecId: "F000015MMA", Name: "Fondo" }] })).toEqual([
      { id: "F000015MMA", name: "Fondo" },
    ]);
    expect(parseMorningstarScreener({ nope: 1 })).toEqual([]);
  });
});

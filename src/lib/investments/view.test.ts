import { describe, expect, it } from "vitest";
import type { Position } from "./engine";
import { averageCostEur, closedRows, priceOrigin } from "./view";

const pos = (assetId: string, extra: Partial<Position> = {}): Position => ({
  assetId,
  quantity: 0,
  costEur: 0,
  realizedEur: 0,
  dividendsEur: 0,
  feesEur: 0,
  investedEur: 0,
  lastPrice: null,
  valueEur: 0,
  ...extra,
});

describe("inversiones · posiciones cerradas", () => {
  it("solo las que tienen operaciones y ya no tienen participaciones, la más reciente primero", () => {
    const positions = new Map([
      ["a", pos("a", { quantity: 3 })],
      ["b", pos("b", { realizedEur: 40, dividendsEur: 5, feesEur: 2, investedEur: 2000 })],
      ["c", pos("c", { realizedEur: -10 })],
      ["d", pos("d")],
    ]);
    const assets = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), kind: "fund" as const }));
    const ops = [
      { assetId: "a", date: "2025-01-01" },
      { assetId: "b", date: "2025-02-01" },
      { assetId: "b", date: "2025-05-02" },
      { assetId: "c", date: "2025-06-01" },
    ];
    const rows = closedRows(positions, assets, ops);
    expect(rows.map((r) => r.assetId)).toEqual(["c", "b"]);
    expect(rows[1]).toMatchObject({ resultEur: 43, closedOn: "2025-05-02", investedEur: 2000 });
  });

  it("coste medio por participación", () => {
    expect(averageCostEur({ quantity: 4, costEur: 100 })).toBe(25);
    expect(averageCostEur({ quantity: 0, costEur: 0 })).toBeNull();
  });
});

describe("inversiones · origen del precio", () => {
  const asset = { price_source: "yahoo", price_symbol: "VWCE.DE", isin: null, currency: "EUR" };

  it("dice la fuente, el símbolo, la moneda y el día", () => {
    expect(priceOrigin(asset, "2026-11-17")).toBe("Yahoo Finance · VWCE.DE · EUR · precio del 17 nov");
    expect(priceOrigin({ ...asset, price_symbol: null, isin: "IE00B4L5Y983" }, null)).toBe(
      "Yahoo Finance · buscando por ISIN IE00B4L5Y983 · EUR · sin precio todavía",
    );
    expect(priceOrigin({ ...asset, price_source: "manual" }, "2026-09-30")).toBe("A mano · precio del 30 sept");
  });
});

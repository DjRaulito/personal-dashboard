import { describe, expect, it } from "vitest";
import { FUND_ORDERS_CSV, INVESTING_CSV, STOCK_OPS_HTML } from "./fixtures";
import { inferFundSides } from "./fund-sides";
import { marketCurrency, parseInvestingCsv } from "./investing-csv";
import { parseFundOrdersCsv, parseStockOperationsHtml } from "./myinvestor";
import { parseDmy, parseDotNumber, parseEsNumber } from "./numbers";
import { reconcile } from "./reconcile";

describe("números de las exportaciones", () => {
  it("formatos es-ES y en-US", () => {
    expect(parseEsNumber("1.342,85 €")).toBe(1342.85);
    expect(parseEsNumber("-6,25%")).toBe(-6.25);
    expect(parseEsNumber("--")).toBeNull();
    expect(parseDotNumber("5451.32826700")).toBeCloseTo(5451.328267);
    expect(parseDmy("05/11/2026")).toBe("2026-11-05");
  });

  it("moneda por mercado", () => {
    expect(marketCurrency("NASDAQ")).toBe("USD");
    expect(marketCurrency("LON")).toBe("GBX");
    expect(marketCurrency("BME")).toBe("EUR");
  });
});

describe("Investing", () => {
  it("lee posiciones, lotes abiertos y cerrados", () => {
    const r = parseInvestingCsv(INVESTING_CSV);
    expect(r.holdings).toHaveLength(3);
    expect(r.openLots).toHaveLength(5);
    expect(r.closedLots).toHaveLength(2);
    expect(r.exportedTotals.marketValueEur).toBe(775);
    expect(r.closedLots[1]).toMatchObject({
      symbol: "AME.O",
      closeDate: "2025-03-05",
      closePrice: 25,
      realizedPnlEur: 45,
    });
  });
});

describe("MyInvestor", () => {
  it("órdenes de fondos: solo las finalizadas", () => {
    const o = parseFundOrdersCsv(FUND_ORDERS_CSV);
    expect(o).toHaveLength(4);
    expect(o[0]).toEqual({ date: "2025-04-30", isin: "LU0000000002", amountEur: 2040, units: 20 });
  });

  it("operaciones de valores", () => {
    const ops = parseStockOperationsHtml(STOCK_OPS_HTML);
    expect(ops.map((o) => o.kind)).toEqual(["sell", "dividend", "buy", "buy", "split_in", "split_out"]);
  });
});

describe("sentido de las órdenes de fondos", () => {
  it("importes redondos = compra; venta si hay posición; cuadra con el objetivo", () => {
    const orders = parseFundOrdersCsv(FUND_ORDERS_CSV);
    const sided = inferFundSides(orders, [], new Map([["LU0000000002", 0]]));
    const byKey = new Map(sided.map((o) => [`${o.date}:${o.isin}`, o.side]));
    expect(byKey.get("2025-02-01:IE0000000001")).toBe("buy");
    expect(byKey.get("2024-12-31:LU0000000002")).toBe("buy");
    expect(byKey.get("2025-04-30:LU0000000002")).toBe("sell");
  });

  it("las pistas fijan el sentido", () => {
    const orders = [{ date: "2025-01-01", isin: "X", amountEur: 333.33, units: 3 }];
    expect(inferFundSides(orders, [{ isin: "X", date: "2025-01-03", units: 3, side: "buy" }])[0]).toMatchObject({
      side: "buy",
      confidence: "hint",
    });
  });
});

describe("conciliación", () => {
  const result = reconcile({
    investing: parseInvestingCsv(INVESTING_CSV),
    fundOrders: parseFundOrdersCsv(FUND_ORDERS_CSV),
    stockOps: parseStockOperationsHtml(STOCK_OPS_HTML),
  });
  const qty = (key: string) =>
    result.operations
      .filter((o) => o.assetKey === key)
      .reduce((s, o) => s + (o.type === "buy" ? o.quantity : o.type === "sell" ? -o.quantity : 0), 0);

  it("enlaza la acción del broker con Investing por operación y nombre", () => {
    const amer = result.assets.find((a) => a.isin === "US0000000003")!;
    expect(amer).toMatchObject({ symbol: "AME.O", currency: "USD" });
    expect(qty("US0000000003")).toBe(0);
  });

  it("agrupa ISIN de un contrasplit y añade el lote de otro broker", () => {
    // 100 -> 10 por el contrasplit, más 50 comprados fuera de MyInvestor según Investing
    const eje = result.assets.find((a) => a.symbol === "EJE.MC")!;
    expect(eje.isin).toBe("ES0000000005");
    expect(qty(eje.key)).toBe(60);
    expect(result.discrepancies.find((d) => d.assetKey === eje.key)).toMatchObject({ investing: 150 });
  });

  it("deduce el ISIN del fondo por las órdenes y usa sus importes", () => {
    const fund = result.assets.find((a) => a.symbol === "LP11111111")!;
    expect(fund.isin).toBe("IE0000000001");
    expect(qty(fund.key)).toBe(15);
    const cash = result.operations.filter((o) => o.assetKey === fund.key).map((o) => o.cashEur);
    expect(cash).toEqual([100, 50]);
  });

  it("lo que solo está en Investing se importa desde sus lotes", () => {
    const otra = result.assets.find((a) => a.symbol === "OTRA.TG")!;
    expect(otra.isin).toBeNull();
    expect(qty(otra.key)).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import {
  computePositions,
  dailySeries,
  periodReturns,
  periodStart,
  valueAt,
  type EngineInput,
  type EngineOperation,
} from "./engine";

const op = (p: Partial<EngineOperation> & Pick<EngineOperation, "type" | "date">): EngineOperation => ({
  assetId: "A",
  quantity: 0,
  price: null,
  cashEur: null,
  grossLocal: null,
  isSplit: false,
  ...p,
});

const base = (operations: EngineOperation[], prices: [string, number][] = [], today = "2025-01-10"): EngineInput => ({
  assets: [{ id: "A", name: "Fondo", currency: "EUR" }],
  operations,
  prices: new Map([["A", prices.map(([date, value]) => ({ date, value }))]]),
  fx: new Map(),
  today,
});

describe("valueAt", () => {
  it("toma el último valor conocido", () => {
    const s = [
      { date: "2025-01-02", value: 1 },
      { date: "2025-01-05", value: 2 },
    ];
    expect(valueAt(s, "2025-01-04")).toBe(1);
    expect(valueAt(s, "2025-01-09")).toBe(2);
    expect(valueAt(s, "2024-12-01")).toBe(1);
    expect(valueAt([], "2025-01-01")).toBeNull();
  });
});

describe("posiciones FIFO", () => {
  it("coste, plusvalía realizada, dividendos y comisiones", () => {
    const input = base(
      [
        op({ type: "buy", date: "2025-01-01", quantity: 10, price: 10, cashEur: 100 }),
        op({ type: "buy", date: "2025-01-02", quantity: 10, price: 12, cashEur: 120 }),
        op({ type: "sell", date: "2025-01-03", quantity: 15, price: 15, cashEur: -225 }),
        op({ type: "dividend", date: "2025-01-04", cashEur: -5 }),
        op({ type: "fee", date: "2025-01-04", cashEur: 1 }),
      ],
      [["2025-01-05", 20]],
    );
    const p = computePositions(input).get("A")!;
    expect(p.quantity).toBe(5);
    expect(p.costEur).toBeCloseTo(60); // quedan 5 del segundo lote a 12
    expect(p.realizedEur).toBeCloseTo(225 - 100 - 60);
    expect(p.dividendsEur).toBe(5);
    expect(p.feesEur).toBe(1);
    expect(p.valueEur).toBe(100);
  });

  it("contrasplit: cambia títulos y conserva el coste", () => {
    const input = base([
      op({ type: "buy", date: "2025-01-01", quantity: 3200, price: 0.15, cashEur: 480 }),
      op({ type: "sell", date: "2025-01-05", quantity: 3200, price: 0, cashEur: 0, isSplit: true }),
      op({ type: "buy", date: "2025-01-05", quantity: 128, price: 0, cashEur: 0, isSplit: true }),
    ]);
    const p = computePositions(input).get("A")!;
    expect(p.quantity).toBeCloseTo(128);
    expect(p.costEur).toBeCloseTo(480);
    expect(p.realizedEur).toBe(0);
  });

  it("convierte con el tipo de cambio cuando no hay importe en euros", () => {
    const input: EngineInput = {
      ...base([op({ type: "buy", date: "2025-01-01", quantity: 2, price: 50, grossLocal: 100 })], [["2025-01-01", 60]]),
      assets: [{ id: "A", name: "Acción", currency: "USD" }],
      fx: new Map([["USD", [{ date: "2025-01-01", value: 0.9 }]]]),
    };
    const p = computePositions(input).get("A")!;
    expect(p.costEur).toBeCloseTo(90);
    expect(p.valueEur).toBeCloseTo(108);
  });

  it("peniques (GBX) con el cambio de la libra", () => {
    const input: EngineInput = {
      ...base(
        [op({ type: "buy", date: "2025-01-01", quantity: 100, price: 500, cashEur: 600 })],
        [["2025-01-01", 500]],
      ),
      assets: [{ id: "A", name: "UK", currency: "GBX" }],
      fx: new Map([["GBP", [{ date: "2025-01-01", value: 1.2 }]]]),
    };
    expect(computePositions(input).get("A")!.valueEur).toBeCloseTo(600);
  });
});

describe("serie diaria y rentabilidad", () => {
  // Compra 100 € el día 1 (precio 10), sube a 11 el día 3, aporta 110 € el día 4, baja a 10,5 el 6
  const input = base(
    [
      op({ type: "buy", date: "2025-01-01", quantity: 10, price: 10, cashEur: 100 }),
      op({ type: "buy", date: "2025-01-04", quantity: 10, price: 11, cashEur: 110 }),
    ],
    [
      ["2025-01-01", 10],
      ["2025-01-03", 11],
      ["2025-01-06", 10.5],
    ],
    "2025-01-06",
  );
  const series = dailySeries(input);

  it("valor, aportaciones y P/G diario", () => {
    expect(series.map((p) => p.date)).toEqual([
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
      "2025-01-06",
    ]);
    expect(series[0]).toMatchObject({ valueEur: 100, flowEur: 100, pnlEur: 0 });
    expect(series[2].pnlEur).toBeCloseTo(10);
    expect(series[3]).toMatchObject({ valueEur: 220, flowEur: 110 });
    expect(series[3].pnlEur).toBeCloseTo(0);
    expect(series[5].pnlEur).toBeCloseTo(-10);
    expect(series.at(-1)!.investedEur).toBe(210);
  });

  it("TWR no se distorsiona por las aportaciones", () => {
    const r = periodReturns(series, "2025-01-06");
    const total = r.find((p) => p.period === "TOTAL")!;
    // +10 % y luego −4,545 %: (1,1 × 0,95454) − 1 = 5 %
    expect(total.returnPct).toBeCloseTo(0.05, 4);
    expect(total.pnlEur).toBeCloseTo(0);
    expect(total.sinceInception).toBe(true);
    const day = r.find((p) => p.period === "1D")!;
    expect(day.pnlEur).toBeCloseTo(-10); // el día 6 baja a 10,5
    expect(day.returnPct).toBeCloseTo(-10 / 220);
  });

  it("periodStart", () => {
    expect(periodStart("YTD", "2026-11-09")).toBe("2025-12-31");
    expect(periodStart("1A", "2026-11-09")).toBe("2025-11-09");
    expect(periodStart("1M", "2026-03-31")).toBe("2026-03-03");
  });
});

describe("exportación a Investing", async () => {
  const { investingCsv } = await import("./investing-export");
  it("solo lotes abiertos, coma decimal y entre comillas", () => {
    const input = base(
      [
        op({ type: "buy", date: "2025-01-01", quantity: 10, price: 10.5, cashEur: 105 }),
        op({ type: "buy", date: "2025-02-01", quantity: 5, price: 12, cashEur: 60 }),
        op({ type: "sell", date: "2025-03-01", quantity: 12, price: 13, cashEur: -156 }),
      ],
      [],
      "2025-04-01",
    );
    const { csv, rows } = investingCsv(input, [
      { id: "A", name: "Fondo X", isin: "IE00B4L5Y983", symbol: null, currency: "EUR" },
    ]);
    expect(rows).toBe(1);
    expect(csv.split("\r\n")[1]).toBe('"IE00B4L5Y983","12","3","BUY","2025-02-01","0","EUR","Fondo X"');
  });
});

describe("splits con precios ajustados", () => {
  // 3200 títulos a 0,15 €; contrasplit 25:1 el día 5 -> 128 títulos. Yahoo da 3,75 € también antes del split.
  const input = base(
    [
      op({ type: "buy", date: "2025-01-01", quantity: 3200, price: 0.15, cashEur: 480 }),
      op({ type: "sell", date: "2025-01-05", quantity: 3200, price: 0, cashEur: 0, isSplit: true }),
      op({ type: "buy", date: "2025-01-05", quantity: 128, price: 0, cashEur: 0, isSplit: true }),
    ],
    [
      ["2025-01-01", 3.75],
      ["2025-01-06", 3.75],
    ],
    "2025-01-08",
  );

  it("el valor no salta en el split", () => {
    const s = dailySeries(input);
    expect(s.map((p) => Math.round(p.valueEur))).toEqual([480, 480, 480, 480, 480, 480, 480, 480]);
    const total = periodReturns(s, "2025-01-08").find((r) => r.period === "TOTAL")!;
    expect(total.returnPct).toBeCloseTo(0);
  });

  it("sin precios de mercado usa el de la operación ajustado", () => {
    const s = dailySeries({ ...input, prices: new Map() });
    expect(Math.round(s[0].valueEur)).toBe(480);
    expect(Math.round(s.at(-1)!.valueEur)).toBe(480);
  });
});

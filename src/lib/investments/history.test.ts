import { describe, expect, it } from "vitest";
import { benchmarkReturnsFrom, historyFrom, historyWindow, parseHistoryRange } from "./history";

const pts = [
  { date: "2026-11-13", value: 100 },
  { date: "2026-11-16", value: 102 },
  { date: "2026-11-19", value: 104 },
  { date: "2026-11-20", value: 99 },
];

describe("histórico de una posición", () => {
  it("1D compara el último cierre con el anterior", () => {
    const r = historyWindow(pts, "1D", "2026-11-20");
    expect(r.points).toHaveLength(2);
    expect(r.changePct).toBeCloseTo(99 / 104 - 1);
  });

  it("1S parte del último cierre anterior a la semana", () => {
    const r = historyWindow(pts, "1S", "2026-11-20");
    expect(r.points[0].date).toBe("2026-11-13");
    expect(r.changePct).toBeCloseTo(-0.01);
  });

  it("pide los datos desde antes del periodo", () => {
    expect(historyFrom("1A", "2026-11-20")).toBe("2025-11-14");
    expect(historyFrom("1D", "2026-11-20")).toBe("2026-11-13");
    expect(parseHistoryRange("5A")).toBe("5A");
    expect(parseHistoryRange(null)).toBe("1A");
  });

  it("sin datos no hay variación", () => {
    expect(historyWindow([], "1M", "2026-11-20")).toEqual({ points: [], changePct: null });
  });
});

describe("comparación con el índice", () => {
  const idx = [
    { date: "2025-12-31", value: 100 },
    { date: "2026-06-30", value: 105 },
    { date: "2026-11-20", value: 110 },
  ];
  it("calcula la variación del índice en cada periodo", () => {
    const r = benchmarkReturnsFrom(idx, ["YTD", "5A", "TOTAL"], "2026-11-20", "2026-07-01");
    expect(r.get("YTD")).toBeCloseTo(0.1);
    // Sin 5 años de datos no se compara
    expect(r.get("5A")).toBeNull();
    // Desde el inicio: desde la víspera de la primera operación
    expect(r.get("TOTAL")).toBeCloseTo(110 / 105 - 1);
  });
});

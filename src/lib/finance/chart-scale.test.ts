import { describe, expect, it } from "vitest";
import { niceScale, toPercent } from "./chart-scale";

describe("niceScale", () => {
  it("redondea a pasos limpios", () => {
    expect(niceScale(0, 183000)).toEqual({ min: 0, max: 200000, ticks: [0, 50000, 100000, 150000, 200000] });
  });

  it("incluye negativos", () => {
    const s = niceScale(-1200, 3400);
    expect(s.min).toBeLessThanOrEqual(-1200);
    expect(s.max).toBeGreaterThanOrEqual(3400);
    expect(s.ticks).toContain(0);
  });

  it("valor único", () => {
    const s = niceScale(500, 500);
    expect(s.min).toBeLessThan(500);
    expect(s.max).toBeGreaterThan(500);
  });

  it("toPercent", () => {
    expect(toPercent(50, 0, 200)).toBe(25);
  });
});

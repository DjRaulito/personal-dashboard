import { describe, expect, it } from "vitest";
import { bettingByPeriod, bettingResult, salaryFor, sumByMonth } from "./income";

describe("salario frente a gastos", () => {
  const detected = sumByMonth([
    { booked_on: "2026-08-20", amount_cents: 11602 },
    { booked_on: "2026-08-31", amount_cents: 192700 },
    { booked_on: "2026-09-30", amount_cents: 192700 },
  ]);

  it("suma las nóminas del mes (nómina + atrasos)", () => {
    expect(salaryFor("2026-08", detected, null, "2026-11")).toEqual({ cents: 204302, source: "detected" });
  });

  it("usa el salario de respaldo solo en el mes en curso sin nómina", () => {
    expect(salaryFor("2026-11", detected, 200000, "2026-11")).toEqual({ cents: 200000, source: "fallback" });
    expect(salaryFor("2026-10", detected, 200000, "2026-11")).toEqual({ cents: 0, source: "none" });
  });
});

describe("casas de apuestas", () => {
  const rows = [
    { booked_on: "2026-01-05", amount_cents: -2500 },
    { booked_on: "2026-01-20", amount_cents: 4000 },
    { booked_on: "2026-02-03", amount_cents: -1000 },
    { booked_on: "2025-12-10", amount_cents: -3000 },
  ];

  it("separa ingresos, retiradas y neto por mes", () => {
    expect(bettingByPeriod(rows, "month")[0]).toEqual({
      key: "2026-02",
      depositedCents: 1000,
      withdrawnCents: 0,
      netCents: -1000,
    });
    expect(bettingByPeriod(rows, "month")[1]).toEqual({
      key: "2026-01",
      depositedCents: 2500,
      withdrawnCents: 4000,
      netCents: 1500,
    });
  });

  it("agrupa por año y cuenta lo que queda en las casas", () => {
    expect(bettingByPeriod(rows, "year").map((p) => [p.key, p.netCents])).toEqual([
      ["2026", 500],
      ["2025", -3000],
    ]);
    expect(bettingResult(rows, 1200)).toBe(-1300);
  });
});

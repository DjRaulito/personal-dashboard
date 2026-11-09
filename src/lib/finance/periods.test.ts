import { describe, expect, it } from "vitest";
import { financePeriods, monthsBetween } from "./periods";

describe("periodos", () => {
  it("usa el mes de Madrid y una ventana de 12 meses", () => {
    // 31 dic 23:30 UTC = 1 ene en Madrid
    expect(financePeriods(new Date("2026-12-31T23:30:00Z"))).toEqual({
      monthStart: "2027-01-01",
      nextMonthStart: "2027-02-01",
      windowStart: "2026-02-01",
      monthKey: "2027-01",
    });
  });

  it("monthsBetween", () => {
    expect(monthsBetween("2026-11-01", "2027-02-01")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
});

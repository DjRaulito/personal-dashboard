import { describe, expect, it } from "vitest";
import { monthGrid, monthKey, parseMonth, shiftMonth } from "./month";

describe("calendario editorial", () => {
  it("lee el mes de la URL o usa el de respaldo", () => {
    expect(parseMonth("2026-02", { year: 2026, month: 11 })).toEqual({ year: 2026, month: 2 });
    expect(parseMonth("2026-13", { year: 2026, month: 11 })).toEqual({ year: 2026, month: 11 });
    expect(parseMonth(undefined, { year: 2026, month: 11 })).toEqual({ year: 2026, month: 11 });
  });

  it("cambia de año al avanzar o retroceder", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("empieza en lunes y cubre semanas completas", () => {
    // Noviembre de 2026 empieza en domingo: la primera fila arranca el lunes 26 de octubre
    const weeks = monthGrid({ year: 2026, month: 11 });
    expect(weeks[0][0]).toEqual({ key: "2026-10-26", day: 26, inMonth: false });
    expect(weeks[0][6]).toEqual({ key: "2026-11-01", day: 1, inMonth: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.at(-1)!.at(-1)!.key).toBe("2026-12-06");
  });
});

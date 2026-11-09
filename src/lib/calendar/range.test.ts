import { describe, expect, it } from "vitest";
import { daysFromToday, parseView, rangeForView } from "./range";

describe("rangos del calendario (Europe/Madrid)", () => {
  // Lunes 9 nov 2026, 00:30 en Madrid (UTC+1) = domingo 8 nov 23:30 UTC
  const now = new Date("2026-11-08T23:30:00Z");

  it("hoy usa el día local, no el UTC", () => {
    const r = rangeForView("hoy", now);
    expect(r.start.toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-09T23:00:00.000Z");
  });

  it("la semana va de lunes a lunes", () => {
    const r = rangeForView("semana", new Date("2026-11-15T12:00:00Z")); // domingo
    expect(r.start.toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-15T23:00:00.000Z");
  });

  it("el mes respeta el cambio de hora", () => {
    const r = rangeForView("mes", new Date("2026-03-15T12:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-02-28T23:00:00.000Z"); // 1 mar, UTC+1
    expect(r.end.toISOString()).toBe("2026-03-31T22:00:00.000Z"); // 1 abr, UTC+2
  });

  it("diciembre pasa a enero del año siguiente", () => {
    const r = rangeForView("mes", new Date("2026-12-20T12:00:00Z"));
    expect(r.end.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("daysFromToday cubre N días completos", () => {
    const r = daysFromToday(now, 2);
    expect(r.end.getTime() - r.start.getTime()).toBe(48 * 3600 * 1000);
  });

  it("parseView cae en 'hoy' con valores raros", () => {
    expect(parseView("mes")).toBe("mes");
    expect(parseView(["semana"])).toBe("semana");
    expect(parseView("año")).toBe("hoy");
    expect(parseView(undefined)).toBe("hoy");
  });
});

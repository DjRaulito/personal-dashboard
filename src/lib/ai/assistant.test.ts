import { describe, expect, it } from "vitest";
import { addDaysIso, dateRange, parseInline, parseMarkdown } from "./assistant";

describe("dateRange", () => {
  it("usa los días por defecto hasta hoy", () => {
    expect(dateRange({}, "2026-11-10", 7)).toEqual({ from: "2026-11-04", to: "2026-11-10" });
  });
  it("respeta el rango e ignora fechas mal formadas", () => {
    expect(dateRange({ desde: "2026-10-01", hasta: "2026-10-31" }, "2026-11-10", 7)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(dateRange({ desde: "ayer" }, "2026-11-10", 2)).toEqual({ from: "2026-11-09", to: "2026-11-10" });
  });
  it("ordena el rango y aplica el tope", () => {
    expect(dateRange({ desde: "2026-11-10", hasta: "2026-11-01" }, "2026-11-10", 7)).toEqual({
      from: "2026-11-01",
      to: "2026-11-10",
    });
    expect(dateRange({ desde: "2020-01-01" }, "2026-11-10", 7, 30).from).toBe(addDaysIso("2026-11-10", -30));
  });
});

describe("mini-markdown", () => {
  it("separa negritas", () => {
    expect(parseInline("Gastaste **120 €** en total")).toEqual([
      { bold: false, text: "Gastaste " },
      { bold: true, text: "120 €" },
      { bold: false, text: " en total" },
    ]);
  });
  it("agrupa párrafos y viñetas y quita títulos", () => {
    const blocks = parseMarkdown("## Resumen\nVas bien.\n\n- uno\n* dos\n1. tres\n\nFin");
    expect(blocks).toEqual([
      { kind: "p", lines: [[{ bold: false, text: "Resumen" }], [{ bold: false, text: "Vas bien." }]] },
      {
        kind: "ul",
        items: [[{ bold: false, text: "uno" }], [{ bold: false, text: "dos" }], [{ bold: false, text: "tres" }]],
      },
      { kind: "p", lines: [[{ bold: false, text: "Fin" }]] },
    ]);
  });
});

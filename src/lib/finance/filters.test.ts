import { describe, expect, it } from "vitest";
import { filtersHref, likePattern, monthBounds, parseFilters } from "./filters";

describe("filtros de movimientos", () => {
  it("ignora valores no válidos en la URL", () => {
    expect(parseFilters({ mes: "2026-13x", cuenta: "no-uuid", pagina: "2", tipo: "otro", q: "  luz " })).toEqual({
      mes: undefined,
      cuenta: undefined,
      categoria: undefined,
      tipo: undefined,
      pagina: 2,
      q: "luz",
    });
    expect(parseFilters({ categoria: "sin" }).categoria).toBe("sin");
  });

  it("monthBounds cruza de año", () => {
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-03-01" });
  });

  it("likePattern escapa comodines", () => {
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
  });

  it("filtersHref conserva filtros y quita la página 1", () => {
    expect(filtersHref("/m", { mes: "2026-11", pagina: 3 }, { pagina: 1 })).toBe("/m?mes=2026-11");
    expect(filtersHref("/m", {}, {})).toBe("/m");
  });
});

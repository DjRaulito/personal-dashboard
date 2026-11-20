import { describe, expect, it } from "vitest";
import { tabIsActive } from "./section-tabs";

describe("pestañas de sección", () => {
  it("la portada solo se marca en su ruta exacta", () => {
    const tab = { href: "/inversiones", label: "Resumen", exact: true };
    expect(tabIsActive(tab, "/inversiones")).toBe(true);
    expect(tabIsActive(tab, "/inversiones/posiciones")).toBe(false);
  });

  it("las demás se marcan en sus subrutas y en las rutas asociadas", () => {
    const tab = { href: "/finanzas/gastos", label: "Gastos", also: ["/finanzas/movimientos"] };
    expect(tabIsActive(tab, "/finanzas/gastos")).toBe(true);
    expect(tabIsActive(tab, "/finanzas/movimientos")).toBe(true);
    expect(tabIsActive(tab, "/finanzas/gastosx")).toBe(false);
    expect(tabIsActive(tab, "/finanzas/analisis")).toBe(false);
  });
});

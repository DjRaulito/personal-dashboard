import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS } from "./navigation";

describe("navegación", () => {
  it("incluye las secciones tras la limpieza", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Hoy",
      "Finanzas",
      "Nutrición",
      "Armario",
      "Cerebro",
      "Tareas",
      "Ajustes",
    ]);
  });

  it("en móvil la barra tiene 4 secciones y «Más» (5 huecos)", () => {
    expect(NAV_ITEMS.filter((i) => !i.more).map((i) => i.label)).toEqual(["Hoy", "Finanzas", "Nutrición", "Armario"]);
    expect(NAV_ITEMS.filter((i) => i.more).map((i) => i.label)).toEqual(["Cerebro", "Tareas", "Ajustes"]);
  });

  it("marca la sección activa", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/cerebro")).toBe(false);
    expect(isActive("/cerebro", "/cerebro")).toBe(true);
    expect(isActive("/nutricion", "/nutricion/plan")).toBe(true);
    expect(isActive("/finanzas", "/finanzasx")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS, SETTINGS_ITEM } from "./navigation";

describe("navegación", () => {
  it("Inversiones es una sección propia, separada de Finanzas", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Hoy",
      "Finanzas",
      "Inversiones",
      "Nutrición",
      "Armario",
      "Tareas",
      "Cerebro",
    ]);
    expect(SETTINGS_ITEM.href).toBe("/ajustes");
  });

  it("en móvil la barra tiene 4 secciones y «Más» (5 huecos)", () => {
    expect(NAV_ITEMS.filter((i) => !i.more).map((i) => i.label)).toEqual([
      "Hoy",
      "Finanzas",
      "Inversiones",
      "Nutrición",
    ]);
    expect(NAV_ITEMS.filter((i) => i.more).map((i) => i.label)).toEqual(["Armario", "Tareas", "Cerebro"]);
  });

  it("marca la sección activa", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/cerebro")).toBe(false);
    expect(isActive("/cerebro", "/cerebro")).toBe(true);
    expect(isActive("/nutricion", "/nutricion/plan")).toBe(true);
    expect(isActive("/finanzas", "/finanzasx")).toBe(false);
    expect(isActive("/inversiones", "/inversiones/posiciones")).toBe(true);
  });
});

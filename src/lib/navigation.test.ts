import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS } from "./navigation";

describe("navegación", () => {
  it("incluye las secciones tras la limpieza", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(["Hoy", "Finanzas", "Nutrición", "Armario", "Cerebro", "Ajustes"]);
  });

  it("en móvil caben todas", () => {
    expect(NAV_ITEMS.filter((i) => !i.desktopOnly)).toHaveLength(6);
  });

  it("marca la sección activa", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/cerebro")).toBe(false);
    expect(isActive("/cerebro", "/cerebro")).toBe(true);
    expect(isActive("/nutricion", "/nutricion/plan")).toBe(true);
    expect(isActive("/finanzas", "/finanzasx")).toBe(false);
  });
});

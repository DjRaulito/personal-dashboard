import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS } from "./navigation";

describe("navegación", () => {
  it("incluye las siete secciones del plan", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Inicio",
      "Finanzas",
      "Calendario",
      "Contenido",
      "Gimnasio",
      "Nutrición",
      "Ajustes",
    ]);
  });

  it("marca la sección activa", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/calendario")).toBe(false);
    expect(isActive("/calendario", "/calendario")).toBe(true);
    expect(isActive("/calendario", "/calendario/x")).toBe(true);
    expect(isActive("/finanzas", "/finanzasx")).toBe(false);
  });
});

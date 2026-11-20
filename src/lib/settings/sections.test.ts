import { describe, expect, it } from "vitest";
import { activeSection, SETTINGS_SECTIONS } from "./sections";

describe("ajustes", () => {
  it("tiene las secciones del plan, en orden", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.title)).toEqual([
      "Cuenta",
      "Conexiones",
      "Finanzas",
      "Nutrición",
      "Tareas",
      "Armario",
      "Datos",
    ]);
  });

  it("sabe en qué sección estás", () => {
    expect(activeSection("/ajustes")).toBeNull();
    expect(activeSection("/ajustes/conexiones")).toBe("conexiones");
    expect(activeSection("/ajustes/finanzas/cuentas")).toBe("finanzas");
    expect(activeSection("/ajustes/otra")).toBeNull();
  });
});

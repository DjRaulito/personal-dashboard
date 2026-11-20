import { describe, expect, it } from "vitest";
import { cleanItem, formatValue, registerSchema } from "./fields";

const fields = [
  { key: "price", label: "Precio", type: "money" as const },
  { key: "sqm", label: "Superficie", type: "area" as const },
  { key: "url", label: "Enlace", type: "url" as const },
  { key: "city", label: "Barrio", type: "text" as const },
];

describe("tareas · resultados", () => {
  it("se queda con los campos declarados y del tipo correcto", () => {
    expect(cleanItem(fields, { price: "185000", sqm: 85, url: "no es url", city: " Centro ", extra: "x" })).toEqual({
      price: 185000,
      sqm: 85,
      city: "Centro",
    });
    expect(cleanItem(fields, { otra: 1 })).toBeNull();
  });

  it("enseña los valores con su unidad", () => {
    expect(formatValue("money", 185000).replace(/\s/g, " ")).toBe("185.000 €");
    expect(formatValue("area", 85)).toBe("85 m²");
    expect(formatValue("date", "2026-11-20")).toBe("20 nov 2026");
    expect(formatValue("text", null)).toBe("—");
  });

  it("valida el registro de una tarea", () => {
    expect(registerSchema.safeParse({ task: "Radar Trabajo", name: "x" }).success).toBe(false);
    const ok = registerSchema.parse({
      task: "radar-trabajo",
      name: "Radar de trabajo",
      fields: [{ key: "salary", label: "Sueldo", type: "raro" }],
    });
    expect(ok.fields[0].type).toBe("text");
  });
});

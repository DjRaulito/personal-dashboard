import { describe, expect, it } from "vitest";
import {
  cleanItem,
  formatValue,
  groupByDay,
  lastChange,
  parseHistory,
  pickView,
  registerSchema,
  valueSeries,
  type TaskField,
} from "./fields";

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

const f = (key: string, type: TaskField["type"]): TaskField => ({ key, label: key, type });

describe("tareas · cómo se pintan", () => {
  it("elige tabla con tres cifras, por día con fecha y tarjetas si no", () => {
    expect(pickView([f("a", "text"), f("p", "number"), f("e", "number"), f("u", "percent")])).toBe("table");
    expect(pickView([f("a", "text"), f("d", "date"), f("p", "money")])).toBe("days");
    expect(pickView([f("a", "text"), f("p", "money"), f("u", "url")])).toBe("cards");
    expect(pickView([f("d", "date")], "cards")).toBe("cards");
    expect(pickView([f("d", "date")], "otra")).toBe("days");
  });

  it("valida sí/no y porcentajes", () => {
    const fs = [f("talla", "boolean"), f("pot", "percent")];
    expect(cleanItem(fs, { talla: "sí", pot: "38.5" })).toEqual({ talla: true, pot: 38.5 });
    expect(cleanItem(fs, { talla: false })).toEqual({ talla: false });
    expect(formatValue("percent", 38.5)).toBe("38,5 %");
    expect(formatValue("boolean", true)).toBe("Sí");
  });

  it("calcula la bajada respecto al último precio distinto", () => {
    const history = parseHistory([
      { at: "2026-11-19T08:00:00Z", data: { price: 749, ram: "32" } },
      { at: "2026-11-18T08:00:00Z", data: { price: 829 } },
      { bad: true },
    ]);
    expect(history).toHaveLength(2);
    expect(lastChange("price", 749, history)).toEqual({ delta: -80, since: "2026-11-18T08:00:00Z" });
    expect(lastChange("price", 799, history)).toEqual({ delta: 50, since: "2026-11-19T08:00:00Z" });
    expect(lastChange("price", "x", history)).toBeNull();
    expect(valueSeries("price", 749, history)).toEqual([829, 749]);
  });

  it("agrupa por día y deja fuera los pasados", () => {
    const items = [{ d: "2026-11-23" }, { d: "2026-11-22T21:00:00Z" }, { d: "2026-11-01" }, { d: null }];
    const g = groupByDay(items, (i) => i.d, "2026-11-20");
    expect(g.days.map(([day, list]) => [day, list.length])).toEqual([
      ["2026-11-22", 1],
      ["2026-11-23", 1],
    ]);
    expect(g.past).toBe(1);
    expect(g.undated).toHaveLength(1);
  });
});

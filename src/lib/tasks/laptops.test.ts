import { describe, expect, it } from "vitest";
import { discount, isOnSale, laptop, specs } from "./laptops";

const now = Date.parse("2026-11-22T10:00:00Z");

describe("portátiles", () => {
  it("lee el modelo y sus especificaciones", () => {
    const l = laptop("k", { modelo: "Portátil X", cpu: "Ryzen AI 7", ram: "32 GB", precio: 799 });
    expect(l.model).toBe("Portátil X");
    expect(specs(l)).toEqual(["Ryzen AI 7", "32 GB"]);
  });

  it("calcula el descuento frente a la referencia", () => {
    expect(discount(laptop("k", { precio: 720, precio_ref: 800 }))).toBeCloseTo(10);
    expect(discount(laptop("k", { precio: 820, precio_ref: 800 }))).toBeNull();
  });

  it("está en oferta si lo marca la tarea, si baja de la referencia o si bajó esta semana", () => {
    expect(isOnSale(laptop("k", { precio: 800, oferta: true }), [], null, now)).toBe(true);
    expect(isOnSale(laptop("k", { precio: 700, precio_ref: 800 }), [], null, now)).toBe(true);
    const history = [{ at: "2026-11-19T08:00:00Z", data: { precio: 850 } }];
    expect(isOnSale(laptop("k", { precio: 800 }), history, "2026-11-20T08:00:00Z", now)).toBe(true);
    expect(isOnSale(laptop("k", { precio: 800 }), history, "2026-11-01T08:00:00Z", now)).toBe(false);
    expect(isOnSale(laptop("k", { precio: 900 }), history, "2026-11-20T08:00:00Z", now)).toBe(false);
  });
});

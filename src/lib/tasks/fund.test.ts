import { describe, expect, it } from "vitest";
import { average, formatPct, formatPrice, fundPosition, sinceBuy, toEntry, upside, upsideFromEntry } from "./fund";

const p = fundPosition("TEST.MC", {
  empresa: "Empresa de prueba",
  estado: "Cartera",
  precio: 50,
  compra: 40,
  entrada: 45,
  objetivo: 60,
  divisa: "eur",
});

describe("fondo value", () => {
  it("lee los datos y normaliza estado y divisa", () => {
    expect(p.state).toBe("cartera");
    expect(p.currency).toBe("EUR");
    expect(fundPosition("X", { estado: "rara" }).state).toBe("otro");
    expect(fundPosition("X", {}).name).toBe("X");
  });

  it("calcula revalorizaciones", () => {
    expect(upside(p)).toBeCloseTo(20);
    expect(sinceBuy(p)).toBeCloseTo(25);
    expect(upsideFromEntry(p)).toBeCloseTo(33.33, 1);
    expect(toEntry(p)).toBeCloseTo(-10);
    expect(upside(fundPosition("X", { precio: 10 }))).toBeNull();
  });

  it("formatea precios y porcentajes", () => {
    expect(formatPrice(4224, "GBX")).toBe("4224 p".replace("4224", (4224).toLocaleString("es-ES")));
    expect(formatPrice(39.43, "EUR")).toContain("39,43");
    expect(formatPrice(null, "EUR")).toBe("—");
    expect(formatPct(5)).toBe("+5,0 %");
    expect(formatPct(-2.25)).toMatch(/^-2,[23] %$/);
    expect(average([1, null, 3])).toBe(2);
    expect(average([null])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { alphaBounds, alphaCoverage, keepMainPieces } from "./alpha";

/** Imagen RGBA transparente con un rectángulo opaco. */
function image(width: number, height: number, rect?: { x: number; y: number; w: number; h: number }) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) data[(y * width + x) * 4 + 3] = 255;
  }
  return data;
}

describe("armario · recorte", () => {
  it("encuentra el rectángulo visible", () => {
    const data = image(100, 80, { x: 20, y: 10, w: 40, h: 50 });
    expect(alphaBounds(data, 100, 80, { padding: 0 })).toEqual({ x: 20, y: 10, width: 40, height: 50 });
    expect(alphaCoverage(data)).toBeCloseTo(0.25);
  });

  it("añade margen sin salirse de la imagen", () => {
    const data = image(100, 100, { x: 0, y: 40, w: 100, h: 20 });
    expect(alphaBounds(data, 100, 100, { padding: 0.1 })).toEqual({ x: 0, y: 30, width: 100, height: 40 });
  });

  it("da null si no queda nada visible", () => {
    expect(alphaBounds(image(50, 50), 50, 50)).toBeNull();
    expect(alphaBounds(image(100, 100, { x: 1, y: 1, w: 2, h: 2 }), 100, 100)).toBeNull();
  });
});

/** Máscara (un valor por píxel) con rectángulos opacos. */
function mask(width: number, height: number, rects: { x: number; y: number; w: number; h: number; v?: number }[]) {
  const data = new Uint8ClampedArray(width * height);
  for (const r of rects)
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) data[y * width + x] = r.v ?? 255;
  return data;
}

describe("armario · piezas sueltas", () => {
  it("borra los trozos pequeños y deja la prenda con su borde suave", () => {
    const m = mask(40, 30, [
      { x: 5, y: 5, w: 20, h: 20 }, // prenda
      { x: 25, y: 5, w: 1, h: 20, v: 60 }, // borde suave pegado a la prenda
      { x: 32, y: 2, w: 3, h: 3 }, // objeto suelto
      { x: 36, y: 20, w: 2, h: 2, v: 60 }, // sombra suelta
    ]);
    const out = keepMainPieces(m, 40, 30);
    expect(out[10 * 40 + 10]).toBe(255);
    expect(out[10 * 40 + 25]).toBe(60);
    expect(out[3 * 40 + 33]).toBe(0);
    expect(out[21 * 40 + 37]).toBe(0);
  });

  it("conserva dos piezas parecidas, como un par de zapatos", () => {
    const m = mask(40, 20, [
      { x: 2, y: 5, w: 14, h: 10 },
      { x: 22, y: 5, w: 12, h: 10 },
    ]);
    const out = keepMainPieces(m, 40, 20);
    expect(out[8 * 40 + 5]).toBe(255);
    expect(out[8 * 40 + 25]).toBe(255);
  });
});

import { describe, expect, it } from "vitest";
import { alphaBounds, alphaCoverage } from "./alpha";

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

// Utilidades sobre el canal alfa de una foto recortada (sin dependencias, se prueban solas).

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectángulo que contiene todos los píxeles visibles de una imagen RGBA, con un margen.
 * Devuelve null si la imagen queda vacía o casi (el recorte ha fallado).
 */
export function alphaBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { threshold = 24, padding = 0.03, minCoverage = 0.01 } = {},
): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let visible = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      visible += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || visible < width * height * minCoverage) return null;
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * padding);
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x,
    y,
    width: Math.min(width, maxX + pad + 1) - x,
    height: Math.min(height, maxY + pad + 1) - y,
  };
}

/** Parte visible de la imagen (0–1): si es casi todo, el recorte no ha separado el fondo. */
export function alphaCoverage(data: Uint8ClampedArray, threshold = 24): number {
  let visible = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > threshold) visible += 1;
  return data.length ? visible / (data.length / 4) : 0;
}

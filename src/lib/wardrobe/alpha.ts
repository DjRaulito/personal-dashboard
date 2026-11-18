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

/**
 * Se queda con las piezas principales de una máscara (un valor 0–255 por píxel): borra los
 * trozos sueltos que el recortador deja a veces (un objeto de la cama, un cable…). Se conserva
 * la pieza más grande y las que miden al menos `minShare` de ella (p. ej. el otro zapato).
 */
export function keepMainPieces(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  { threshold = 128, minShare = 0.25 } = {},
): Uint8ClampedArray {
  const labels = new Int32Array(width * height);
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (labels[start] || mask[start] < threshold) continue;
    const label = sizes.length;
    let size = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      size += 1;
      const x = i % width;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width];
      for (const n of neighbours) {
        if (n < 0 || n >= mask.length || labels[n] || mask[n] < threshold) continue;
        labels[n] = label;
        stack.push(n);
      }
    }
    sizes.push(size);
  }
  if (sizes.length <= 2) return mask;
  const largest = Math.max(...sizes);
  const keep = sizes.map((s) => s >= largest * minShare);
  const out = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    if (labels[i]) {
      if (keep[labels[i]]) out[i] = mask[i];
      continue;
    }
    // Borde suave: se queda si toca una pieza que se conserva
    const x = i % width;
    for (let dy = -2; dy <= 2 && !out[i]; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (x + dx < 0 || x + dx >= width) continue;
        const n = i + dy * width + dx;
        if (n >= 0 && n < mask.length && labels[n] && keep[labels[n]]) {
          out[i] = mask[i];
          break;
        }
      }
    }
  }
  return out;
}

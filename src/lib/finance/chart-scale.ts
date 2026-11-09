/** Escala "bonita" para un eje: devuelve ticks redondos que cubren [min, max]. */
export function niceScale(min: number, max: number, targetTicks = 4): { min: number; max: number; ticks: number[] } {
  if (min === max) {
    const pad = Math.abs(max) || 100;
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return { min: lo, max: hi, ticks };
}

/** Posición en % (0 abajo, 100 arriba) de un valor dentro de la escala. */
export function toPercent(value: number, min: number, max: number): number {
  return max === min ? 0 : ((value - min) / (max - min)) * 100;
}

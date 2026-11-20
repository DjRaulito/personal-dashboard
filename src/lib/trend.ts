// Subidas y bajadas: nunca solo por color. La clase añade ▲ o ▼ delante (ver globals.css)
// y el color (celeste / naranja de Okabe-Ito) solo lo refuerza.

export const trendClass = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) || Math.abs(v) < 1e-9
    ? "text-muted"
    : v > 0
      ? "trend-up text-up"
      : "trend-down text-down";

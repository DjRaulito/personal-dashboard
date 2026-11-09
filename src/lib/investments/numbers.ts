// Números tal y como vienen en las exportaciones (es-ES y en-US mezclados).

/** "1.342,85 €" -> 1342.85 · "-6,25%" -> -6.25 · "--" -> null */
export function parseEsNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = raw
    .replace(/[€%\s ]/g, "")
    .replace(/^\+/, "")
    .trim();
  if (!s || s === "-" || s === "--") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "16.74580000" (punto decimal) -> 16.7458 */
export function parseDotNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = raw.replace(/[\s ]/g, "").trim();
  if (!s || s === "-" || s === "--") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "2,234" (coma decimal, sin miles) -> 2.234 */
export function parseCommaDecimal(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = raw.replace(/[\s ]/g, "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "05/11/2026" -> "2026-11-05" */
export function parseDmy(raw: string | undefined | null): string | null {
  const m = raw?.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

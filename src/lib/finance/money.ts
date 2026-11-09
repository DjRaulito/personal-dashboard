import { APP_LOCALE } from "@/lib/datetime";

/** Formatea céntimos como moneda (es-ES): 123456 -> "1234,56 €". */
export function formatCents(cents: number, currency = "EUR", opts: { signed?: boolean } = {}): string {
  const formatted = new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(cents / 100);
  // Intl usa el signo menos tipográfico; lo dejamos así salvo espacios raros
  return formatted.replace(/ /g, " ");
}

/** Versión compacta para ejes y tarjetas: 12 300 € -> "12,3 mil €". */
export function formatCentsCompact(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(cents / 100)
    .replace(/ /g, " ");
}

/** Euros a céntimos, redondeando la mitad lejos de cero (evita 12.345 * 100 = 1234.4999…). */
function toCents(value: number): number {
  const cents = Math.round(Math.abs(value) * 100 + 1e-7);
  return value < 0 ? -cents : cents;
}

export type DecimalSeparator = "," | ".";

/**
 * Convierte un importe escrito como texto a céntimos.
 * Acepta "1.234,56", "-12,30", "12,30-", "(12.30)", "€ 5", "+3". Devuelve null si no es un número.
 */
export function parseAmountToCents(raw: unknown, decimal: DecimalSeparator = ","): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? toCents(raw) : null;
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[\s €$£]|EUR|USD|GBP/gi, "");
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  const thousands = decimal === "," ? "." : ",";
  s = s.split(thousands).join("");
  if (decimal === ",") s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const cents = toCents(Number(s));
  return negative ? -cents : cents;
}

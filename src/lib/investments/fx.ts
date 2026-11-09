import { z } from "zod";

// Tipos de cambio diarios del BCE vía Frankfurter (gratis, sin clave). Solo servidor.

const HOSTS = ["https://api.frankfurter.app", "https://api.frankfurter.dev/v1"];

const schema = z.object({ rates: z.record(z.string(), z.record(z.string(), z.number())) });

/** Euros por unidad de cada divisa y día: 1 EUR = 1,08 USD -> 1 USD = 0,9259 EUR. */
export function parseFrankfurter(json: unknown): Map<string, { date: string; value: number }[]> {
  const out = new Map<string, { date: string; value: number }[]>();
  const rates = schema.parse(json).rates;
  for (const date of Object.keys(rates).sort()) {
    for (const [currency, perEur] of Object.entries(rates[date])) {
      if (perEur > 0) out.set(currency, [...(out.get(currency) ?? []), { date, value: 1 / perEur }]);
    }
  }
  return out;
}

export async function fetchFxSeries(currencies: string[], from: string, to: string) {
  const list = currencies.filter((c) => c !== "EUR").join(",");
  if (!list) return new Map<string, { date: string; value: number }[]>();
  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}/${from}..${to}?from=EUR&to=${list}`, { cache: "no-store" });
      if (res.ok) return parseFrankfurter(await res.json());
      lastError = new Error(`Frankfurter ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

import { z } from "zod";

// Precios diarios de Yahoo Finance (API pública sin clave). Solo servidor.

const UA = "Mozilla/5.0 (compatible; personal-dashboard/1.0)";
const HOSTS = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];

/** Traduce símbolos de Investing (estilo Reuters) a Yahoo. */
export function investingToYahoo(symbol: string, market: string | null): string | null {
  const s = symbol.trim();
  if (/^(LP\d|0P)/i.test(s)) return null; // fondos: se buscan por ISIN
  const m = (market ?? "").toUpperCase();
  if (/\.(O|K|N|A|P)$/.test(s)) return s.replace(/\.(O|K|N|A|P)$/, ""); // NASDAQ/NYSE
  const special: Record<string, string> = { "KWSG.DE": "KWS.DE", "HLUNb.CO": "HLUN-B.CO" };
  if (special[s]) return special[s];
  if (/b\.CO$/.test(s)) return s.replace(/b\.CO$/, "-B.CO");
  if (!s.includes(".") && m === "BME") return `${s}.MC`;
  if (!s.includes(".") && (m === "NYSE" || m === "NASDAQ")) return s;
  return s;
}

const searchSchema = z.object({
  quotes: z
    .array(
      z.object({
        symbol: z.string(),
        quoteType: z.string().optional(),
        longname: z.string().optional(),
        shortname: z.string().optional(),
        exchange: z.string().optional(),
      }),
    )
    .default([]),
});

export interface YahooQuote {
  symbol: string;
  name: string | null;
  quoteType: string | null;
}

async function yahooFetch(path: string): Promise<unknown> {
  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { headers: { "User-Agent": UA }, cache: "no-store" });
      if (res.ok) return await res.json();
      lastError = new Error(`Yahoo ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export async function yahooSearch(query: string): Promise<YahooQuote[]> {
  const json = await yahooFetch(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`);
  return searchSchema.parse(json).quotes.map((q) => ({
    symbol: q.symbol,
    name: q.longname ?? q.shortname ?? null,
    quoteType: q.quoteType ?? null,
  }));
}

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({ currency: z.string().nullable().optional() }),
          timestamp: z.array(z.number()).optional(),
          indicators: z.object({
            quote: z.array(z.object({ close: z.array(z.number().nullable()).optional() })),
            adjclose: z.array(z.object({ adjclose: z.array(z.number().nullable()).optional() })).optional(),
          }),
        }),
      )
      .nullable(),
  }),
});

export interface DailyCloses {
  currency: string | null;
  points: { date: string; value: number }[];
}

/** Convierte la respuesta de /v8/finance/chart en cierres diarios (sin huecos nulos). */
export function parseChart(json: unknown): DailyCloses {
  const result = chartSchema.parse(json).chart.result?.[0];
  if (!result?.timestamp) return { currency: result?.meta.currency ?? null, points: [] };
  const closes = result.indicators.quote[0]?.close ?? [];
  const byDate = new Map<string, number>();
  result.timestamp.forEach((t, i) => {
    const v = closes[i];
    if (v != null && Number.isFinite(v) && v > 0) byDate.set(new Date(t * 1000).toISOString().slice(0, 10), v);
  });
  return {
    currency: result.meta.currency ?? null,
    points: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
  };
}

export async function yahooDailyCloses(symbol: string, from: string, to: string): Promise<DailyCloses> {
  const p1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const p2 = Math.floor(Date.parse(`${to}T23:59:59Z`) / 1000);
  return parseChart(
    await yahooFetch(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplit`,
    ),
  );
}

/**
 * Factor para pasar un precio de Yahoo a la moneda del activo.
 * Yahoo cotiza Londres en peniques ("GBp"); devuelve null si las monedas no son compatibles.
 */
export function currencyFactor(quote: string | null, asset: string): number | null {
  if (!quote) return 1;
  if (quote === asset) return 1;
  if (quote === "GBp" && asset === "GBP") return 0.01;
  if (quote === "GBp" && asset === "GBX") return 1;
  if (quote === "GBP" && asset === "GBX") return 100;
  if (quote === "ILA" && asset === "ILS") return 0.01;
  return null;
}

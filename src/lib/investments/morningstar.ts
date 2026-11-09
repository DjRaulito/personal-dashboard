import { z } from "zod";

// Valores liquidativos de fondos europeos desde Morningstar (API pública sin clave). Solo servidor.
// Se usa cuando Yahoo no tiene el fondo. En la BD el símbolo se guarda como "ms:<id>".

export const MS_PREFIX = "ms:";
const UA = "Mozilla/5.0 (compatible; personal-dashboard/1.0)";

/** Busca el id de Morningstar (p. ej. F000015MMA) de un ISIN. */
export async function morningstarSearch(isin: string): Promise<{ id: string; name: string | null }[]> {
  const res = await fetch(
    `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(isin)}&limit=5`,
    {
      headers: { "User-Agent": UA },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Morningstar ${res.status}`);
  return parseMorningstarSearch(await res.text());
}

/** La respuesta son líneas "Nombre|{json}|..."; el json trae "i" (id) y "n" (nombre). */
export function parseMorningstarSearch(text: string): { id: string; name: string | null }[] {
  const out: { id: string; name: string | null }[] = [];
  for (const line of text.split("\n")) {
    const json = line.split("|").find((p) => p.trim().startsWith("{"));
    if (!json) continue;
    try {
      const data = JSON.parse(json) as { i?: string; n?: string };
      if (data.i && /^[A-Z0-9]{10}$/.test(data.i)) out.push({ id: data.i, name: data.n ?? line.split("|")[0] ?? null });
    } catch {
      // línea no válida
    }
  }
  return out;
}

const seriesSchema = z.array(z.tuple([z.number(), z.number()]));

/** Cierres diarios en EUR. */
export async function morningstarDailyCloses(id: string, from: string, to: string) {
  const query =
    `?id=${encodeURIComponent(id)}%5D2%5D0%5DFOESP%24%24ALL` +
    `&currencyId=EUR&idtype=Morningstar&frequency=daily&startDate=${from}&endDate=${to}&outputType=COMPACTJSON`;
  let lastError: unknown;
  for (const host of [
    "https://lt.morningstar.com/api/rest.svc/timeseries_price/klr5zyak8x",
    "https://tools.morningstar.es/api/rest.svc/timeseries_price/2nhcdckzon",
  ]) {
    try {
      const res = await fetch(`${host}${query}`, { headers: { "User-Agent": UA }, cache: "no-store" });
      if (res.ok) return parseMorningstarSeries(await res.json());
      lastError = new Error(`Morningstar ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export function parseMorningstarSeries(json: unknown) {
  const rows = seriesSchema.parse(json);
  const byDate = new Map<string, number>();
  for (const [ms, value] of rows) if (value > 0) byDate.set(new Date(ms).toISOString().slice(0, 10), value);
  return {
    currency: "EUR" as string | null,
    points: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
  };
}

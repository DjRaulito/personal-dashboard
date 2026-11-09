import "server-only";
import { dayKey } from "@/lib/datetime";
import type { createClient } from "@/lib/supabase/server";
import { addDays, valueAt } from "./engine";
import { fetchFxSeries } from "./fx";
import { currencyFactor, investingToYahoo, yahooDailyCloses, yahooSearch, type YahooQuote } from "./yahoo";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface RefreshResult {
  resolved: number;
  prices: number;
  fx: number;
  errors: string[];
}

const fxCurrency = (c: string) => (c === "GBX" ? "GBP" : c);

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * Busca un símbolo de Yahoo con cotizaciones recientes: por ISIN, por el símbolo de Investing
 * y por nombre. Se queda con el primer candidato que devuelva cierres de las últimas semanas.
 */
export async function resolveYahooSymbol(
  a: { name: string; isin: string | null; symbol: string | null; market: string | null; price_symbol: string | null },
  today: string,
): Promise<{ symbol: string; name: string | null; tried: string[] } | null> {
  const candidates: YahooQuote[] = [];
  const add = (list: YahooQuote[]) => {
    for (const q of list) if (!candidates.some((c) => c.symbol === q.symbol)) candidates.push(q);
  };
  if (a.price_symbol) add([{ symbol: a.price_symbol, name: null, quoteType: null }]);
  if (a.isin) add(await yahooSearch(a.isin).catch(() => []));
  const mapped = a.symbol ? investingToYahoo(a.symbol, a.market) : null;
  if (mapped) add([{ symbol: mapped, name: null, quoteType: null }]);
  add(await yahooSearch(a.name.replace(/\b(ADR|INC|PLC|SICAV|SA|SE)\b/gi, "").trim()).catch(() => []));

  const from = addDays(today, -30);
  // Se prueban en paralelo y gana el primero de la lista que tenga cotizaciones
  const list = candidates.slice(0, 8);
  const ok = await Promise.all(
    list.map((c) =>
      yahooDailyCloses(c.symbol, from, today)
        .then(({ points }) => points.length >= 3)
        .catch(() => false),
    ),
  );
  const i = ok.indexOf(true);
  return i >= 0 ? { symbol: list[i].symbol, name: list[i].name, tried: list.map((c) => c.symbol) } : null;
}

/** Descarga lo que falte de precios y tipos de cambio para la cartera del usuario. */
export async function refreshMarketData(supabase: Supabase): Promise<RefreshResult> {
  const today = dayKey(new Date());
  // Margen antes del límite de 60 s de Vercel: lo que no dé tiempo se hace en la siguiente actualización
  const deadline = Date.now() + 45_000;
  const late = () => Date.now() > deadline;
  const result: RefreshResult = { resolved: 0, prices: 0, fx: 0, errors: [] };

  const [{ data: assets }, { data: ops }] = await Promise.all([
    supabase.from("assets").select("id, name, isin, symbol, market, currency, price_source, price_symbol"),
    supabase.from("investment_operations").select("asset_id, trade_date, type, quantity").order("trade_date"),
  ]);
  if (!assets?.length || !ops?.length) return result;

  // Rango necesario por activo: desde su primera operación hasta hoy (o hasta su cierre)
  const range = new Map<string, { from: string; to: string }>();
  const qty = new Map<string, number>();
  for (const o of ops) {
    const r = range.get(o.asset_id) ?? { from: o.trade_date, to: o.trade_date };
    r.to = o.trade_date;
    range.set(o.asset_id, r);
    const sign = o.type === "buy" ? 1 : o.type === "sell" ? -1 : 0;
    qty.set(o.asset_id, (qty.get(o.asset_id) ?? 0) + sign * Number(o.quantity));
  }
  for (const [id, r] of range) if ((qty.get(id) ?? 0) > 1e-4) r.to = today;
  const firstDate = addDays(ops[0].trade_date, -7);

  // 1. Resolver el símbolo de Yahoo de los activos que no lo tienen o cuyo símbolo no da precios
  // Menos de 5 cierres = el símbolo no sirve (o no se ha descargado nada todavía)
  const counts = await Promise.all(
    assets.map(async (a) => {
      const { count } = await supabase
        .from("asset_prices")
        .select("asset_id", { count: "exact", head: true })
        .eq("asset_id", a.id)
        .eq("source", "yahoo");
      return [a.id, count ?? 0] as const;
    }),
  );
  const hasPrices = new Set(counts.filter(([, n]) => n >= 5).map(([id]) => id));
  const held = (id: string) => (qty.get(id) ?? 0) > 1e-4;
  const byPriority = <T extends { id: string }>(list: T[]) =>
    [...list].sort((x, y) => Number(held(y.id)) - Number(held(x.id)));
  await inBatches(
    byPriority(assets.filter((a) => a.price_source === "yahoo" && (!a.price_symbol || !hasPrices.has(a.id)))),
    4,
    async (a) => {
      if (late()) return;
      try {
        const hit = await resolveYahooSymbol(a, today);
        if (!hit)
          return void result.errors.push(`Sin precios en Yahoo para ${a.name}: ponlo a mano o indica su símbolo`);
        if (hit.symbol === a.price_symbol) return;
        const update: { price_symbol: string; name?: string } = { price_symbol: hit.symbol };
        if (hit.name && a.name === a.isin) update.name = hit.name.slice(0, 120);
        await supabase.from("assets").update(update).eq("id", a.id);
        // Los precios del símbolo anterior no sirven
        if (a.price_symbol) await supabase.from("asset_prices").delete().eq("asset_id", a.id).eq("source", "yahoo");
        a.price_symbol = hit.symbol;
        if (update.name) a.name = update.name;
        result.resolved++;
      } catch (e) {
        result.errors.push(`${a.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    },
  );

  // 2. Tipos de cambio que falten
  const currencies = [...new Set(assets.map((a) => fxCurrency(a.currency)).filter((c) => c !== "EUR"))];
  const fx = new Map<string, { date: string; value: number }[]>();
  if (currencies.length) {
    const { data: stored } = await supabase
      .from("fx_rates")
      .select("currency, rate_date, eur_per_unit")
      .order("rate_date");
    for (const r of stored ?? []) {
      fx.set(r.currency, [...(fx.get(r.currency) ?? []), { date: r.rate_date, value: Number(r.eur_per_unit) }]);
    }
    const lastStored = currencies.map((c) => fx.get(c)?.at(-1)?.date ?? null);
    const from = lastStored.some((d) => !d) ? firstDate : addDays(lastStored.sort()[0]!, 1);
    if (from <= today) {
      try {
        const fresh = await fetchFxSeries(currencies, from, today);
        const rows = [...fresh.entries()].flatMap(([currency, points]) =>
          points.map((p) => ({ currency, rate_date: p.date, eur_per_unit: p.value })),
        );
        for (let i = 0; i < rows.length; i += 1000) {
          const { error } = await supabase.from("fx_rates").upsert(rows.slice(i, i + 1000));
          if (error) throw error;
        }
        for (const [c, points] of fresh) fx.set(c, [...(fx.get(c) ?? []), ...points]);
        result.fx = rows.length;
      } catch (e) {
        result.errors.push(`Tipos de cambio: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }
  const eurPer = (c: string, date: string) =>
    c === "EUR" ? 1 : (valueAt(fx.get(fxCurrency(c)), date) ?? 0) / (c === "GBX" ? 100 : 1);

  // 3. Precios que falten
  await inBatches(
    byPriority(assets.filter((a) => a.price_source === "yahoo" && a.price_symbol && range.has(a.id))),
    6,
    async (a) => {
      if (late()) return;
      const r = range.get(a.id)!;
      const { data: last } = await supabase
        .from("asset_prices")
        .select("price_date")
        .eq("asset_id", a.id)
        .eq("source", "yahoo")
        .order("price_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const from = last ? addDays(last.price_date, 1) : addDays(r.from, -7);
      if (from > r.to) return;
      try {
        const { currency, points } = await yahooDailyCloses(a.price_symbol!, from, r.to);
        if (points.length === 0) return;
        const factor = currencyFactor(currency, a.currency);
        const rows = points.map((p) => {
          let close = p.value * (factor ?? 1);
          if (factor == null && currency) {
            // Otra moneda: convertir con el cambio del día
            const q = eurPer(currency, p.date);
            const t = eurPer(a.currency, p.date);
            close = q && t ? (p.value * q) / t : NaN;
          }
          return { asset_id: a.id, price_date: p.date, close, source: "yahoo" };
        });
        const valid = rows.filter((row) => Number.isFinite(row.close) && row.close > 0);
        for (let i = 0; i < valid.length; i += 1000) {
          const { error } = await supabase.from("asset_prices").upsert(valid.slice(i, i + 1000));
          if (error) throw error;
        }
        result.prices += valid.length;
      } catch (e) {
        result.errors.push(`${a.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    },
  );

  if (late()) result.errors.push("No dio tiempo a todo: pulsa «Actualizar precios» otra vez para terminar.");
  return result;
}

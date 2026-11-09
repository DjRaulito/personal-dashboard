import "server-only";
import { cache } from "react";
import { dayKey } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import {
  computePositions,
  dailySeries,
  periodReturns,
  type EngineInput,
  type EngineOperation,
  type PricePoint,
} from "./engine";
import type { AssetKind } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lee todas las filas de una consulta paginando de 1000 en 1000 (límite de PostgREST). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Igual que fetchAll pero pide todas las páginas a la vez (para tablas grandes). */
async function fetchAllParallel<T>(
  count: () => PromiseLike<{ count: number | null; error: unknown }>,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const { count: total, error } = await count();
  if (error) throw error;
  const pages = Math.max(1, Math.ceil((total ?? 0) / 1000));
  const results = await Promise.all(Array.from({ length: pages }, (_, i) => page(i * 1000, i * 1000 + 999)));
  const out: T[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    out.push(...(r.data ?? []));
  }
  return out;
}

export interface AssetRow {
  id: string;
  name: string;
  isin: string | null;
  symbol: string | null;
  market: string | null;
  kind: AssetKind;
  currency: string;
  broker: string;
  price_source: string;
  price_symbol: string | null;
}

export const getPortfolio = cache(async () => {
  const supabase: Supabase = await createClient();
  const today = dayKey(new Date());
  const [assets, ops, prices, fxRows] = await Promise.all([
    fetchAll<AssetRow>(
      (f, t) =>
        supabase
          .from("assets")
          .select("id, name, isin, symbol, market, kind, currency, broker, price_source, price_symbol")
          .order("name")
          .range(f, t) as unknown as PromiseLike<{ data: AssetRow[] | null; error: unknown }>,
    ),
    fetchAll((f, t) =>
      supabase
        .from("investment_operations")
        .select("id, asset_id, type, trade_date, quantity, price, cash_eur_cents, gross_local, is_split, source, notes")
        .order("trade_date")
        .range(f, t),
    ),
    fetchAllParallel(
      () => supabase.from("asset_prices").select("asset_id", { count: "exact", head: true }),
      (f, t) =>
        supabase
          .from("asset_prices")
          .select("asset_id, price_date, close")
          .order("price_date")
          .order("asset_id")
          .range(f, t),
    ),
    fetchAll((f, t) =>
      supabase.from("fx_rates").select("currency, rate_date, eur_per_unit").order("rate_date").range(f, t),
    ),
  ]);

  const priceMap = new Map<string, PricePoint[]>();
  for (const p of prices) {
    const list = priceMap.get(p.asset_id) ?? [];
    list.push({ date: p.price_date, value: Number(p.close) });
    priceMap.set(p.asset_id, list);
  }
  const fx = new Map<string, PricePoint[]>();
  for (const r of fxRows) {
    const list = fx.get(r.currency) ?? [];
    list.push({ date: r.rate_date, value: Number(r.eur_per_unit) });
    fx.set(r.currency, list);
  }

  const operations: (EngineOperation & { id: string; source: string; notes: string | null })[] = ops.map((o) => ({
    id: o.id,
    assetId: o.asset_id,
    type: o.type as EngineOperation["type"],
    date: o.trade_date,
    quantity: Number(o.quantity),
    price: o.price == null ? null : Number(o.price),
    cashEur: o.cash_eur_cents == null ? null : o.cash_eur_cents / 100,
    grossLocal: o.gross_local == null ? null : Number(o.gross_local),
    isSplit: o.is_split,
    source: o.source,
    notes: o.notes,
  }));

  const input: EngineInput = {
    assets: assets.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    operations,
    prices: priceMap,
    fx,
    today,
  };
  const series = dailySeries(input);
  const lastPriceDate = prices.at(-1)?.price_date ?? null;
  return {
    today,
    assets,
    operations,
    input,
    positions: computePositions(input),
    series,
    returns: periodReturns(series, today),
    lastPriceDate,
  };
});

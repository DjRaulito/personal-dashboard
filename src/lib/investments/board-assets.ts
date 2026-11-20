import type { BoardAsset } from "./board";
import { operationCashEur } from "./engine";
import type { getPortfolio } from "./server";
import { averageCostEur, closedRows, positionRows, priceOrigin } from "./view";

type Portfolio = Awaited<ReturnType<typeof getPortfolio>>;

/** Datos de la lista de posiciones y de su panel, de la más grande a la más pequeña. */
export function boardAssets(pf: Portfolio): BoardAsset[] {
  const rows = positionRows(pf.input, pf.positions, pf.assets);
  const rowById = new Map(rows.map((r) => [r.assetId, r]));
  const closedById = new Map(closedRows(pf.positions, pf.assets, pf.operations).map((r) => [r.assetId, r]));
  const engineAssets = new Map(pf.input.assets.map((a) => [a.id, a]));
  const opsByAsset = new Map<string, BoardAsset["operations"]>();
  for (const op of pf.operations) {
    const list = opsByAsset.get(op.assetId) ?? [];
    list.push({
      id: op.id,
      type: op.type,
      date: op.date,
      quantity: op.quantity,
      price: op.price,
      cashEur: operationCashEur(op, engineAssets.get(op.assetId)!, pf.input.fx),
      isSplit: op.isSplit,
      source: op.source,
      notes: op.notes,
    });
    opsByAsset.set(op.assetId, list);
  }
  const board: BoardAsset[] = pf.assets.map((a) => {
    const p = pf.positions.get(a.id);
    const row = rowById.get(a.id);
    const closed = closedById.get(a.id);
    const lastPriceDate = pf.input.prices.get(a.id)?.at(-1)?.date ?? null;
    return {
      id: a.id,
      name: a.name,
      isin: a.isin,
      kind: a.kind,
      currency: a.currency,
      priceSource: a.price_source,
      priceSymbol: a.price_symbol,
      priceOrigin: priceOrigin(a, lastPriceDate),
      lastPrice: p?.lastPrice ?? null,
      lastPriceDate,
      quantity: p?.quantity ?? 0,
      costEur: p?.costEur ?? 0,
      valueEur: p?.valueEur ?? 0,
      avgCostEur: p ? averageCostEur(p) : null,
      dayChangePct: row?.dayChangePct ?? null,
      realizedEur: p?.realizedEur ?? 0,
      dividendsEur: p?.dividendsEur ?? 0,
      feesEur: p?.feesEur ?? 0,
      weight: row?.weight ?? 0,
      open: Boolean(row),
      resultEur: closed?.resultEur ?? 0,
      closedOn: closed?.closedOn ?? null,
      operations: opsByAsset.get(a.id) ?? [],
    };
  });
  return board.sort((x, y) => y.valueEur - x.valueEur);
}

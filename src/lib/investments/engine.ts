// Motor de la cartera: posiciones (FIFO), serie diaria de valor y rentabilidades.
// Todo en euros salvo los precios, que van en la moneda del activo.

export interface EngineAsset {
  id: string;
  name: string;
  currency: string; // GBX = peniques
}

export interface EngineOperation {
  assetId: string;
  type: "buy" | "sell" | "dividend" | "fee";
  date: string;
  quantity: number;
  price: number | null;
  cashEur: number | null; // + sale dinero, − entra
  grossLocal: number | null;
  isSplit: boolean;
}

export interface PricePoint {
  date: string;
  value: number;
}

export interface EngineInput {
  assets: EngineAsset[];
  operations: EngineOperation[];
  prices: Map<string, PricePoint[]>; // por activo, en su moneda
  fx: Map<string, PricePoint[]>; // por divisa: euros por unidad
  today: string;
}

// ---------------------------------------------------------------------------
// Utilidades de series
// ---------------------------------------------------------------------------

/** Último valor con fecha ≤ date (o el primero si date es anterior a todos). */
export function valueAt(series: PricePoint[] | undefined, date: string): number | null {
  if (!series || series.length === 0) return null;
  let lo = 0;
  let hi = series.length - 1;
  if (date < series[0].date) return series[0].value;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].date <= date) lo = mid;
    else hi = mid - 1;
  }
  return series[lo].value;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eurPerUnit(fx: Map<string, PricePoint[]>, currency: string, date: string): number {
  if (currency === "EUR") return 1;
  if (currency === "GBX") return (valueAt(fx.get("GBP"), date) ?? 0) / 100;
  return valueAt(fx.get(currency), date) ?? 0;
}

// ---------------------------------------------------------------------------
// Posiciones (FIFO)
// ---------------------------------------------------------------------------

export interface Lot {
  quantity: number;
  costEur: number;
  date: string;
  price: number | null; // en la moneda del activo
}

export interface Position {
  assetId: string;
  quantity: number;
  costEur: number; // coste de lo que queda (FIFO)
  realizedEur: number; // plusvalías realizadas (ventas)
  dividendsEur: number;
  feesEur: number;
  investedEur: number; // compras totales
  lastPrice: number | null;
  valueEur: number;
}

const EPS = 1e-6;

/** Importe en euros de una operación (usa el cambio del día si no viene en euros). */
export function operationCashEur(op: EngineOperation, asset: EngineAsset, fx: Map<string, PricePoint[]>): number {
  if (op.cashEur != null) return op.cashEur;
  if (op.grossLocal != null) return op.grossLocal * eurPerUnit(fx, asset.currency, op.date);
  if (op.price != null) {
    const gross = op.quantity * op.price * eurPerUnit(fx, asset.currency, op.date);
    return op.type === "sell" ? -gross : gross;
  }
  return 0;
}

function sortOps(ops: EngineOperation[]) {
  // Mismo día: primero compras (incluidas las altas de splits), luego ventas
  const rank = (o: EngineOperation) => (o.isSplit ? 0 : o.type === "buy" ? 1 : o.type === "sell" ? 2 : 3);
  return [...ops].sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b));
}

export function computePositions(input: EngineInput, upTo = input.today): Map<string, Position> {
  return runFifo(input, upTo).positions;
}

/** Lotes abiertos por activo (FIFO), con fecha y precio de compra. */
export function computeOpenLots(input: EngineInput, upTo = input.today): Map<string, Lot[]> {
  return runFifo(input, upTo).lots;
}

function runFifo(input: EngineInput, upTo: string) {
  const assets = new Map(input.assets.map((a) => [a.id, a]));
  const lots = new Map<string, Lot[]>();
  const positions = new Map<string, Position>();
  const pos = (id: string) => {
    let p = positions.get(id);
    if (!p) {
      p = {
        assetId: id,
        quantity: 0,
        costEur: 0,
        realizedEur: 0,
        dividendsEur: 0,
        feesEur: 0,
        investedEur: 0,
        lastPrice: null,
        valueEur: 0,
      };
      positions.set(id, p);
    }
    return p;
  };

  const ops = sortOps(input.operations.filter((o) => o.date <= upTo));
  // Splits: se agrupan por activo y día y se aplican como un cambio de escala de los lotes
  const splitDelta = new Map<string, number>();
  for (const o of ops)
    if (o.isSplit) {
      const k = `${o.assetId}|${o.date}`;
      splitDelta.set(k, (splitDelta.get(k) ?? 0) + (o.type === "buy" ? o.quantity : -o.quantity));
    }
  const splitDone = new Set<string>();

  for (const op of ops) {
    const asset = assets.get(op.assetId);
    if (!asset) continue;
    const p = pos(op.assetId);
    const assetLots = lots.get(op.assetId) ?? [];
    lots.set(op.assetId, assetLots);

    if (op.isSplit) {
      const k = `${op.assetId}|${op.date}`;
      if (splitDone.has(k)) continue;
      splitDone.add(k);
      const qty = assetLots.reduce((s, l) => s + l.quantity, 0);
      const delta = splitDelta.get(k) ?? 0;
      if (qty > EPS && Math.abs(delta) > EPS) {
        const ratio = (qty + delta) / qty;
        for (const l of assetLots) {
          l.quantity *= ratio;
          if (l.price != null) l.price /= ratio;
        }
      }
      continue;
    }

    const cash = operationCashEur(op, asset, input.fx);
    if (op.type === "buy") {
      assetLots.push({ quantity: op.quantity, costEur: cash, date: op.date, price: op.price });
      p.investedEur += cash;
    } else if (op.type === "sell") {
      let remaining = op.quantity;
      let cost = 0;
      while (remaining > EPS && assetLots.length) {
        const lot = assetLots[0];
        const take = Math.min(lot.quantity, remaining);
        const part = lot.quantity > EPS ? lot.costEur * (take / lot.quantity) : 0;
        cost += part;
        lot.costEur -= part;
        lot.quantity -= take;
        remaining -= take;
        if (lot.quantity <= EPS) assetLots.shift();
      }
      p.realizedEur += -cash - cost;
    } else if (op.type === "dividend") {
      p.dividendsEur += -cash;
    } else if (op.type === "fee") {
      p.feesEur += cash;
    }
  }

  for (const [id, p] of positions) {
    const assetLots = lots.get(id) ?? [];
    p.quantity = assetLots.reduce((s, l) => s + l.quantity, 0);
    if (p.quantity < 1e-4) p.quantity = 0;
    p.costEur = p.quantity ? assetLots.reduce((s, l) => s + l.costEur, 0) : 0;
    const asset = assets.get(id)!;
    p.lastPrice = priceSeries(input, id).length ? valueAt(priceSeries(input, id), upTo) : null;
    p.valueEur =
      p.quantity && p.lastPrice != null ? p.quantity * p.lastPrice * eurPerUnit(input.fx, asset.currency, upTo) : 0;
  }
  return { positions, lots };
}

// Serie de precios de un activo: precios guardados + precios de sus operaciones como respaldo
const priceCache = new WeakMap<EngineInput, Map<string, PricePoint[]>>();
function priceSeries(input: EngineInput, assetId: string): PricePoint[] {
  let cache = priceCache.get(input);
  if (!cache) {
    cache = new Map();
    priceCache.set(input, cache);
  }
  const hit = cache.get(assetId);
  if (hit) return hit;
  const stored = input.prices.get(assetId) ?? [];
  const byDate = new Map<string, number>();
  for (const o of input.operations) {
    if (o.assetId === assetId && !o.isSplit && o.price && o.price > 0 && (o.type === "buy" || o.type === "sell")) {
      byDate.set(o.date, o.price);
    }
  }
  for (const p of stored) byDate.set(p.date, p.value); // los precios de mercado mandan
  const series = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  cache.set(assetId, series);
  return series;
}

// ---------------------------------------------------------------------------
// Serie diaria y rentabilidades
// ---------------------------------------------------------------------------

export interface DailyPoint {
  date: string;
  valueEur: number;
  flowEur: number; // aportación neta del día (+ dinero que entra en la cartera)
  pnlEur: number; // ganancia/pérdida del día
  returnPct: number; // rentabilidad del día (TWR)
  investedEur: number; // aportaciones netas acumuladas
}

export function dailySeries(input: EngineInput): DailyPoint[] {
  const ops = sortOps(input.operations);
  if (ops.length === 0) return [];
  const assets = new Map(input.assets.map((a) => [a.id, a]));
  const series = new Map(input.assets.map((a) => [a.id, priceSeries(input, a.id)]));

  // Cantidad por activo a lo largo del tiempo (los splits cambian la cantidad sin dinero)
  const qty = new Map<string, number>();
  const out: DailyPoint[] = [];
  let i = 0;
  let prevValue = 0;
  let invested = 0;

  for (let date = ops[0].date; date <= input.today; date = addDays(date, 1)) {
    let flow = 0;
    while (i < ops.length && ops[i].date === date) {
      const op = ops[i++];
      const asset = assets.get(op.assetId);
      if (!asset) continue;
      if (op.type === "buy") qty.set(op.assetId, (qty.get(op.assetId) ?? 0) + op.quantity);
      if (op.type === "sell") qty.set(op.assetId, (qty.get(op.assetId) ?? 0) - op.quantity);
      if (!op.isSplit) flow += operationCashEur(op, asset, input.fx);
    }
    let value = 0;
    for (const [id, q] of qty) {
      if (q <= 1e-4) continue;
      const price = valueAt(series.get(id), date);
      if (price != null) value += q * price * eurPerUnit(input.fx, assets.get(id)!.currency, date);
    }
    invested += flow;
    const pnl = value - prevValue - flow;
    // Aportaciones al inicio del día (Dietz diario)
    const base = prevValue + Math.max(flow, 0);
    const ret = base > 1e-6 ? pnl / base : 0;
    out.push({ date, valueEur: value, flowEur: flow, pnlEur: pnl, returnPct: ret, investedEur: invested });
    prevValue = value;
  }
  return out;
}

export const PERIODS = ["1D", "1S", "1M", "3M", "YTD", "1A", "3A", "5A", "TOTAL"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  "1D": "Hoy",
  "1S": "1 semana",
  "1M": "1 mes",
  "3M": "3 meses",
  YTD: "Este año",
  "1A": "1 año",
  "3A": "3 años",
  "5A": "5 años",
  TOTAL: "Desde el inicio",
};

/** Fecha de inicio (exclusiva) de cada periodo. */
export function periodStart(period: Period, today: string): string | null {
  const [y, m, d] = today.split("-").map(Number);
  const back = (years: number, months = 0) => {
    const dt = new Date(Date.UTC(y - years, m - 1 - months, d));
    return dt.toISOString().slice(0, 10);
  };
  switch (period) {
    case "1D":
      return addDays(today, -1);
    case "1S":
      return addDays(today, -7);
    case "1M":
      return back(0, 1);
    case "3M":
      return back(0, 3);
    case "YTD":
      return `${y - 1}-12-31`;
    case "1A":
      return back(1);
    case "3A":
      return back(3);
    case "5A":
      return back(5);
    case "TOTAL":
      return null;
  }
}

export interface PeriodReturn {
  period: Period;
  returnPct: number | null; // null si no hay datos en el periodo
  pnlEur: number;
  sinceInception: boolean; // el periodo empieza antes de la primera operación
}

export function periodReturns(series: DailyPoint[], today: string): PeriodReturn[] {
  const first = series[0]?.date;
  return PERIODS.map((period) => {
    const start = periodStart(period, today);
    const days = series.filter((p) => (!start || p.date > start) && p.date <= today);
    if (days.length === 0) return { period, returnPct: null, pnlEur: 0, sinceInception: false };
    const twr = days.reduce((acc, p) => acc * (1 + p.returnPct), 1) - 1;
    const pnl = days.reduce((s, p) => s + p.pnlEur, 0);
    return { period, returnPct: twr, pnlEur: pnl, sinceInception: !start || (first !== undefined && start < first) };
  });
}

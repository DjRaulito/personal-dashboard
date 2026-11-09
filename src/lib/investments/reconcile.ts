import { marketCurrency, type InvestingExport, type InvestingLot } from "./investing-csv";
import type { MexemOperation } from "./mexem";
import type { FundOrder, StockOperation } from "./myinvestor";
import { inferFundSides, type SidedOrder, type SideHint } from "./fund-sides";
import type { DraftAsset, DraftOperation } from "./types";

// Une las tres fuentes en una sola lista de activos y operaciones.
// - Acciones: mandan las operaciones del broker (MyInvestor); Investing solo aporta símbolo y mercado.
// - Fondos: los lotes de Investing dan el sentido (compra/venta); las órdenes de MyInvestor dan ISIN e importe.
// - Lo que solo está en Investing (p. ej. MEXEM) se importa desde sus lotes.

export interface Discrepancy {
  assetKey: string;
  name: string;
  computed: number;
  investing: number;
}

export interface ReconcileResult {
  assets: DraftAsset[];
  operations: DraftOperation[];
  /** Órdenes de fondos cuyo sentido (compra/venta) es dudoso: conviene revisarlas. */
  doubtfulOrders: SidedOrder[];
  /** Diferencias de cantidad final frente a Investing. */
  discrepancies: Discrepancy[];
  warnings: string[];
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export const isFundSymbol = (symbol: string) => /^(LP\d|0P)/i.test(symbol);

function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !["INC", "ADR", "THE", "CORP", "FUND", "SICAV", "CLASS"].includes(w));
}

function sameQty(a: number, b: number, rel = 0.002, abs = 0.002) {
  return Math.abs(a - b) <= Math.max(abs, Math.abs(b) * rel);
}

// ---------------------------------------------------------------------------
// Acciones del broker
// ---------------------------------------------------------------------------

/** Agrupa ISIN que son el mismo valor (contrasplits, equiparaciones). */
function stockAliasMap(ops: StockOperation[]): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const byDate = new Map<string, StockOperation[]>();
  for (const op of ops)
    if (op.kind === "split_in" || op.kind === "split_out") {
      byDate.set(op.date, [...(byDate.get(op.date) ?? []), op]);
    }
  for (const group of byDate.values()) {
    const outs = group.filter((o) => o.kind === "split_out");
    const ins = group.filter((o) => o.kind === "split_in");
    for (const o of outs) for (const i of ins) parent.set(find(o.isin), find(i.isin));
  }
  // El valor final (el último "alta") es la raíz
  return new Map(ops.map((o) => [o.isin, find(o.isin)]));
}

function brokerStock(ops: StockOperation[]) {
  const alias = stockAliasMap(ops);
  const assets = new Map<string, DraftAsset>();
  const operations: DraftOperation[] = [];

  // Nombre del activo: el de la operación más reciente con el ISIN raíz
  const sorted = [...ops].sort((a, b) => b.date.localeCompare(a.date));
  for (const op of sorted) {
    const key = alias.get(op.isin)!;
    if (!assets.has(key) && op.isin === key) {
      assets.set(key, {
        key,
        name: op.name,
        isin: key,
        symbol: null,
        market: op.market,
        kind: "stock",
        currency: op.currency,
        broker: "myinvestor",
      });
    }
  }
  for (const op of sorted) {
    const key = alias.get(op.isin)!;
    if (!assets.has(key)) {
      assets.set(key, {
        key,
        name: op.name,
        isin: key,
        symbol: null,
        market: op.market,
        kind: "stock",
        currency: op.currency,
        broker: "myinvestor",
      });
    }
  }

  for (const op of ops) {
    const assetKey = alias.get(op.isin)!;
    const base = { assetKey, date: op.date, source: "myinvestor" as const, externalId: `myi:${op.id}` };
    switch (op.kind) {
      case "buy":
        operations.push({
          ...base,
          type: "buy",
          quantity: op.quantity,
          price: op.netPrice,
          cashEur: op.currency === "EUR" ? op.netAmount : null,
          grossLocal: op.netAmount,
        });
        break;
      case "sell":
        operations.push({
          ...base,
          type: "sell",
          quantity: op.quantity,
          price: op.netPrice,
          cashEur: op.currency === "EUR" ? -op.netAmount : null,
          grossLocal: -op.netAmount,
        });
        break;
      case "dividend":
        operations.push({
          ...base,
          type: "dividend",
          quantity: 0,
          price: null,
          cashEur: op.currency === "EUR" ? -op.netAmount : null,
          grossLocal: -op.netAmount,
        });
        break;
      case "fee":
        operations.push({
          ...base,
          type: "fee",
          quantity: 0,
          price: null,
          cashEur: op.currency === "EUR" ? op.netAmount : null,
          grossLocal: op.netAmount,
        });
        break;
      case "split_in":
      case "split_out": {
        // Cambio de número de títulos sin movimiento de dinero
        const delta = op.kind === "split_in" ? op.quantity : -op.quantity;
        operations.push({
          ...base,
          type: delta > 0 ? "buy" : "sell",
          quantity: Math.abs(delta),
          price: 0,
          cashEur: 0,
          grossLocal: 0,
          split: true,
        });
        break;
      }
    }
  }
  return { assets, operations };
}

// ---------------------------------------------------------------------------
// Conciliación principal
// ---------------------------------------------------------------------------

interface InvestingAssetGroup {
  symbol: string;
  name: string;
  market: string;
  open: InvestingLot[];
  closed: InvestingLot[];
}

function groupInvesting(inv: InvestingExport | null): InvestingAssetGroup[] {
  if (!inv) return [];
  const groups = new Map<string, InvestingAssetGroup>();
  const add = (lot: InvestingLot, closed: boolean) => {
    const g = groups.get(lot.symbol) ?? {
      symbol: lot.symbol,
      name: lot.name,
      market: lot.market,
      open: [],
      closed: [],
    };
    (closed ? g.closed : g.open).push(lot);
    groups.set(lot.symbol, g);
  };
  inv.openLots.forEach((l) => add(l, false));
  inv.closedLots.forEach((l) => add(l, true));
  return [...groups.values()];
}

/** Puntuación de parecido entre un activo de Investing y uno del broker. */
function matchScore(group: InvestingAssetGroup, assetName: string, brokerOps: DraftOperation[]): number {
  let score = 0;
  const trades = brokerOps.filter((o) => !o.split && (o.type === "buy" || o.type === "sell"));
  const lots = [
    ...group.open.map((l) => ({ type: "buy", date: l.openDate, qty: l.quantity })),
    ...group.closed.flatMap((l) => [
      { type: "buy", date: l.openDate, qty: l.quantity },
      { type: "sell", date: l.closeDate!, qty: l.quantity },
    ]),
  ];
  for (const lot of lots) {
    if (
      trades.some(
        (t) =>
          t.type === lot.type && sameQty(t.quantity, lot.qty, 0, 1e-6) && Math.abs(daysBetween(t.date, lot.date)) <= 5,
      )
    )
      score += 2;
  }
  // Por nombre solo si comparten al menos dos palabras ("Global Ship Lease" ≠ "Global Dominion")
  const b = new Set(nameTokens(assetName));
  if (nameTokens(group.name).filter((t) => b.has(t)).length >= 2) score += 1;
  return score;
}

/** Añade las operaciones de MEXEM a los activos del broker (por ISIN o por nombre) o crea activos nuevos. */
function addMexem(stock: ReturnType<typeof brokerStock>, ops: MexemOperation[]) {
  const keyBySymbol = new Map<string, string>();
  for (const op of ops) {
    if (keyBySymbol.has(op.symbol)) continue;
    const name = op.type === "buy" || op.type === "sell" ? op.name : null;
    let key = op.isin && stock.assets.has(op.isin) ? op.isin : null;
    if (!key && name) {
      const tokens = new Set(nameTokens(name));
      for (const [k, a] of stock.assets) {
        if (nameTokens(a.name).filter((t) => tokens.has(t)).length >= 2) key = k;
      }
    }
    if (!key) key = op.isin ?? `MEXEM:${op.symbol}`;
    keyBySymbol.set(op.symbol, key);
  }
  for (const op of ops) {
    const key = keyBySymbol.get(op.symbol)!;
    if (!stock.assets.has(key)) {
      const trade = ops.find((o) => o.symbol === op.symbol && (o.type === "buy" || o.type === "sell"));
      stock.assets.set(key, {
        key,
        name: trade?.name ?? op.symbol,
        isin: op.isin,
        symbol: null,
        market: null,
        kind: "stock",
        currency: trade?.currency ?? "EUR",
        broker: "mexem",
      });
    }
    stock.operations.push({
      assetKey: key,
      type: op.type,
      date: op.date,
      quantity: op.type === "buy" || op.type === "sell" ? op.quantity : 0,
      price: op.price,
      cashEur: -op.netEur,
      grossLocal: -op.netEur,
      source: "mexem",
      externalId: `mexem:${op.date}:${op.symbol}:${op.type}:${op.quantity}`,
    });
  }
}

export function reconcile(input: {
  investing: InvestingExport | null;
  fundOrders: FundOrder[];
  stockOps: StockOperation[];
  mexemOps?: MexemOperation[];
}): ReconcileResult {
  const warnings: string[] = [];
  const stock = brokerStock(input.stockOps);
  addMexem(stock, input.mexemOps ?? []);
  const assets = new Map(stock.assets);
  const operations = [...stock.operations];
  const opsByAsset = (key: string) => operations.filter((o) => o.assetKey === key);
  const investingQty = new Map<string, number>(); // clave de activo -> cantidad en Investing
  const holdingQty = new Map((input.investing?.holdings ?? []).map((h) => [h.symbol, h.quantity]));
  const hints: SideHint[] = [];
  const fundIsins = new Set(input.fundOrders.map((o) => o.isin));

  const counter = new Map<string, number>();
  const extId = (base: string) => {
    const n = (counter.get(base) ?? 0) + 1;
    counter.set(base, n);
    return `${base}:${n}`;
  };

  const lotOps = (
    key: string,
    symbol: string,
    currency: string,
    lot: InvestingLot,
    closed: boolean,
  ): DraftOperation[] => {
    const buyGross = lot.quantity * lot.entryPrice;
    const out: DraftOperation[] = [
      {
        assetKey: key,
        type: "buy",
        date: lot.openDate,
        quantity: lot.quantity,
        price: lot.entryPrice,
        cashEur: currency === "EUR" ? round(buyGross + lot.commissionEur) : null,
        grossLocal: round(buyGross, 4),
        source: "investing",
        externalId: extId(`inv:${symbol}:b:${lot.openDate}:${lot.quantity}`),
      },
    ];
    if (closed) {
      const sellGross = lot.quantity * lot.closePrice!;
      out.push({
        assetKey: key,
        type: "sell",
        date: lot.closeDate!,
        quantity: lot.quantity,
        price: lot.closePrice!,
        cashEur: currency === "EUR" ? -round(sellGross) : null,
        grossLocal: -round(sellGross, 4),
        source: "investing",
        externalId: extId(`inv:${symbol}:s:${lot.closeDate}:${lot.quantity}`),
      });
    }
    return out;
  };

  for (const group of groupInvesting(input.investing)) {
    const held = holdingQty.get(group.symbol) ?? 0;

    // 1. Acción que ya viene del broker: completar símbolo y añadir lotes que el broker no tiene (otro broker)
    if (!isFundSymbol(group.symbol)) {
      let best: { key: string; score: number } | null = null;
      for (const [key, asset] of stock.assets) {
        if (asset.symbol) continue;
        const score = matchScore(group, asset.name, opsByAsset(key));
        if (score >= 1 && (!best || score > best.score)) best = { key, score };
      }
      if (best) {
        const asset = assets.get(best.key)!;
        assets.set(best.key, { ...asset, symbol: group.symbol, market: group.market, name: group.name });
        investingQty.set(best.key, held);
        const brokerQty = netQty(opsByAsset(best.key));
        let missing = held - brokerQty;
        // Lotes abiertos de Investing que no están en el broker y explican la diferencia
        for (const lot of [...group.open].sort((a, b) => b.openDate.localeCompare(a.openDate))) {
          if (missing <= 1e-6) break;
          const inBroker = opsByAsset(best.key).some(
            (o) =>
              o.type === "buy" &&
              sameQty(o.quantity, lot.quantity, 0, 1e-6) &&
              Math.abs(daysBetween(o.date, lot.openDate)) <= 5,
          );
          if (!inBroker && lot.quantity <= missing + 1e-6) {
            operations.push(...lotOps(best.key, group.symbol, asset.currency, lot, false));
            missing -= lot.quantity;
          }
        }
        continue;
      }
    }

    // 2. Fondos: deducir el ISIN votando con las órdenes que encajan
    const isFund = isFundSymbol(group.symbol);
    let isin: string | null = null;
    if (isFund) {
      const votes = new Map<string, number>();
      const lots = [...group.open, ...group.closed];
      // Primero por participaciones; si nada encaja, por importe (Investing a veces sigue otra clase del fondo)
      for (const byCost of [false, true]) {
        for (const lot of lots) {
          for (const o of input.fundOrders) {
            const nearDate = (d: string | undefined) =>
              !!d && daysBetween(o.date, d) >= -3 && daysBetween(o.date, d) <= 10;
            const near = nearDate(lot.openDate) || nearDate(lot.closeDate);
            const hit = byCost
              ? Math.abs(lot.quantity * lot.entryPrice - o.amountEur) <= Math.max(1, o.amountEur * 0.01)
              : sameQty(o.units, lot.quantity);
            if (near && hit) votes.set(o.isin, (votes.get(o.isin) ?? 0) + 1);
          }
        }
        if (votes.size) break;
      }
      isin = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      if (!isin) warnings.push(`No encontré el ISIN de "${group.name}" en las órdenes de MyInvestor.`);
    }

    const key = isin ?? `INV:${group.symbol}`;
    const currency = isFund ? "EUR" : marketCurrency(group.market);
    investingQty.set(key, (investingQty.get(key) ?? 0) + held);
    if (!assets.has(key)) {
      assets.set(key, {
        key,
        name: group.name,
        isin,
        symbol: group.symbol,
        market: group.market,
        kind: isFund ? "fund" : "stock",
        currency,
        broker: isFund ? "myinvestor" : "other",
      });
    }

    // Fondo con órdenes de MyInvestor: las órdenes mandan; los lotes solo sirven de pista
    if (isin && fundIsins.has(isin)) {
      for (const l of group.open) hints.push({ isin, date: l.openDate, units: l.quantity, side: "buy" });
      for (const l of group.closed) {
        hints.push({ isin, date: l.openDate, units: l.quantity, side: "buy" });
        hints.push({ isin, date: l.closeDate!, units: l.quantity, side: "sell" });
      }
      continue;
    }
    for (const lot of group.open) operations.push(...lotOps(key, group.symbol, currency, lot, false));
    for (const lot of group.closed) operations.push(...lotOps(key, group.symbol, currency, lot, true));
  }

  // 3. Órdenes de fondos de MyInvestor con el sentido deducido
  const exportDate = input.investing
    ? [...input.investing.openLots, ...input.investing.closedLots]
        .flatMap((l) => [l.openDate, l.closeDate ?? l.openDate])
        .sort()
        .at(-1)!
    : null;
  const targets = new Map<string, number>();
  if (input.investing) {
    for (const isin of fundIsins) {
      const key = isin;
      // Cantidad en Investing + compras posteriores a su última operación registrada
      const later = input.fundOrders.filter((o) => o.isin === isin && exportDate && o.date > exportDate);
      targets.set(isin, (investingQty.get(key) ?? 0) + later.reduce((s, o) => s + o.units, 0));
    }
  }
  const sided = inferFundSides(input.fundOrders, hints, targets);
  for (const o of sided) {
    if (!assets.has(o.isin)) {
      assets.set(o.isin, {
        key: o.isin,
        name: o.isin,
        isin: o.isin,
        symbol: null,
        market: null,
        kind: "fund",
        currency: "EUR",
        broker: "myinvestor",
      });
    }
    operations.push({
      assetKey: o.isin,
      type: o.side,
      date: o.date,
      quantity: o.units,
      price: o.units ? round(o.amountEur / o.units, 6) : null,
      cashEur: o.side === "buy" ? o.amountEur : -o.amountEur,
      grossLocal: o.side === "buy" ? o.amountEur : -o.amountEur,
      source: "myinvestor",
      externalId: extId(`myif:${o.date}:${o.isin}:${o.units}`),
    });
  }

  // 4. Diferencias de cantidad final frente a Investing
  const discrepancies: Discrepancy[] = [];
  for (const [key, inv] of investingQty) {
    const computed = netQty(operations.filter((o) => o.assetKey === key));
    const later = input.fundOrders.filter((o) => o.isin === key && exportDate && o.date > exportDate);
    const expected = inv + later.reduce((s, o) => s + o.units, 0);
    if (Math.abs(computed - expected) > 0.01) {
      discrepancies.push({ assetKey: key, name: assets.get(key)?.name ?? key, computed, investing: expected });
    }
  }

  return {
    assets: [...assets.values()].filter((a) => operations.some((o) => o.assetKey === a.key)),
    operations: operations.sort((a, b) => a.date.localeCompare(b.date)),
    doubtfulOrders: sided.filter((o) => o.confidence === "default" || o.confidence === "position"),
    discrepancies,
    warnings,
  };
}

function netQty(ops: DraftOperation[]): number {
  return ops.reduce((s, o) => s + (o.type === "buy" ? o.quantity : o.type === "sell" ? -o.quantity : 0), 0);
}

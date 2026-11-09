import type { FundOrder } from "./myinvestor";

// Deduce si cada orden de fondo fue compra o venta (el CSV de MyInvestor no lo dice).

export type Side = "buy" | "sell";
export type Confidence = "hint" | "transfer" | "round" | "position" | "default";

export interface SidedOrder extends FundOrder {
  side: Side;
  confidence: Confidence;
}

export interface SideHint {
  isin: string;
  date: string;
  units: number;
  side: Side;
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;
const isRound = (o: FundOrder) => o.amountEur % 50 === 0;
const sameUnits = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.002, Math.abs(b) * 0.002);

/**
 * Reglas, por orden de prioridad:
 * 1. Pista externa (lote de Investing con mismas participaciones y fecha cercana).
 * 2. Importe redondo (múltiplo de 50 €): aportación periódica, compra.
 * 3. Traspaso: otra orden (no redonda) de otro fondo con importe casi igual a ≤10 días; vende el que tenía posición.
 * 4. Si no hay posición suficiente, compra; si la hay, venta (marcada como dudosa).
 */
export function inferFundSides(
  orders: FundOrder[],
  hints: SideHint[] = [],
  targets: Map<string, number> = new Map(),
): SidedOrder[] {
  const sided = firstPass(orders, hints);
  return targets.size ? fixToTargets(sided, targets) : sided;
}

/** Margen para participaciones redondeadas (p. ej. a 3 decimales). */
const tol = (units: number) => Math.max(0.002, units * 0.005);

function isValid(orders: SidedOrder[], isin: string): boolean {
  let pos = 0;
  for (const o of orders) {
    if (o.isin !== isin) continue;
    pos += o.side === "buy" ? o.units : -o.units;
    if (pos < -0.002) return false;
  }
  return true;
}

function finalQty(orders: SidedOrder[], isin: string) {
  return orders.filter((o) => o.isin === isin).reduce((s, o) => s + (o.side === "buy" ? o.units : -o.units), 0);
}

/**
 * Si la cantidad final de un fondo no cuadra con la real (Investing), prueba a cambiar el sentido
 * de una o dos órdenes de ese fondo hasta que cuadre sin dejar nunca la posición en negativo.
 */
function fixToTargets(orders: SidedOrder[], targets: Map<string, number>): SidedOrder[] {
  const out = [...orders];
  const flip = (o: SidedOrder): SidedOrder => ({
    ...o,
    side: o.side === "buy" ? "sell" : "buy",
    confidence: "position",
  });
  for (const [isin, target] of targets) {
    const ok = () => Math.abs(finalQty(out, isin) - target) <= 0.01;
    if (ok()) continue;
    const idx = out.map((o, i) => (o.isin === isin ? i : -1)).filter((i) => i >= 0);
    let fixed = false;
    for (const i of idx) {
      const prev = out[i];
      out[i] = flip(prev);
      if (ok() && isValid(out, isin)) {
        fixed = true;
        break;
      }
      out[i] = prev;
    }
    for (let a = 0; !fixed && a < idx.length; a++) {
      for (let b = a + 1; !fixed && b < idx.length; b++) {
        const [pa, pb] = [out[idx[a]], out[idx[b]]];
        out[idx[a]] = flip(pa);
        out[idx[b]] = flip(pb);
        if (ok() && isValid(out, isin)) fixed = true;
        else {
          out[idx[a]] = pa;
          out[idx[b]] = pb;
        }
      }
    }
  }
  return out;
}

function firstPass(orders: FundOrder[], hints: SideHint[]): SidedOrder[] {
  const opening = new Map<string, number>();
  const sorted = [...orders].sort((a, b) => a.date.localeCompare(b.date) || b.amountEur - a.amountEur);
  const hintsLeft = [...hints];
  const fixed = new Map<FundOrder, { side: Side; confidence: Confidence }>();

  for (const o of sorted) {
    const i = hintsLeft.findIndex(
      (h) =>
        h.isin === o.isin &&
        sameUnits(o.units, h.units) &&
        daysBetween(o.date, h.date) >= -3 &&
        daysBetween(o.date, h.date) <= 10,
    );
    if (i >= 0) {
      fixed.set(o, { side: hintsLeft[i].side, confidence: "hint" });
      hintsLeft.splice(i, 1);
    }
  }

  const position = new Map(opening);
  const pos = (isin: string) => position.get(isin) ?? 0;
  const result: SidedOrder[] = [];

  for (const o of sorted) {
    let decided = fixed.get(o);
    if (!decided && isRound(o)) decided = { side: "buy", confidence: "round" };
    if (!decided) {
      const partner = sorted.find(
        (p) =>
          p !== o &&
          !isRound(p) &&
          p.isin !== o.isin &&
          Math.abs(daysBetween(o.date, p.date)) <= 10 &&
          Math.abs(p.amountEur - o.amountEur) <= Math.max(2, o.amountEur * 0.015),
      );
      if (partner) {
        const partnerSide = fixed.get(partner)?.side;
        const canSell = pos(o.isin) >= o.units - tol(o.units);
        const side: Side = partnerSide ? (partnerSide === "buy" ? "sell" : "buy") : canSell ? "sell" : "buy";
        decided = { side, confidence: "transfer" };
        if (!fixed.has(partner)) fixed.set(partner, { side: side === "sell" ? "buy" : "sell", confidence: "transfer" });
      } else if (pos(o.isin) >= o.units - tol(o.units)) {
        decided = { side: "sell", confidence: "position" };
      } else {
        decided = { side: "buy", confidence: "default" };
      }
    }
    // Una venta nunca puede dejar la posición en negativo
    if (decided.side === "sell" && pos(o.isin) < o.units - tol(o.units))
      decided = { side: "buy", confidence: "default" };
    position.set(o.isin, pos(o.isin) + (decided.side === "buy" ? o.units : -o.units));
    result.push({ ...o, ...decided });
  }
  return result;
}

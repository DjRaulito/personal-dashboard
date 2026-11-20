// Datos que la lista de posiciones y su panel reciben del servidor (serializables).
import type { AssetKind } from "./types";

export interface BoardOperation {
  id: string;
  type: "buy" | "sell" | "dividend" | "fee";
  date: string;
  quantity: number;
  price: number | null;
  /** Efectivo en euros con signo: + sale dinero (compra, comisión), − entra (venta, dividendo). */
  cashEur: number;
  isSplit: boolean;
  source: string;
  notes: string | null;
}

export interface BoardAsset {
  id: string;
  name: string;
  isin: string | null;
  kind: AssetKind;
  currency: string;
  priceSource: string;
  priceSymbol: string | null;
  /** «Yahoo Finance · VWCE.DE · EUR · precio del 17 nov». */
  priceOrigin: string;
  lastPrice: number | null;
  lastPriceDate: string | null;
  quantity: number;
  costEur: number;
  valueEur: number;
  avgCostEur: number | null;
  dayChangePct: number | null;
  realizedEur: number;
  dividendsEur: number;
  feesEur: number;
  weight: number;
  open: boolean;
  /** Resultado final (cerradas): realizada + dividendos − comisiones. */
  resultEur: number;
  closedOn: string | null;
  operations: BoardOperation[];
}

export const OPERATION_LABELS: Record<BoardOperation["type"], string> = {
  buy: "Compra",
  sell: "Venta",
  dividend: "Dividendo",
  fee: "Comisión",
};

/** Busca activos por nombre, ISIN o símbolo, sin tildes ni mayúsculas. */
export function matchAsset(asset: Pick<BoardAsset, "name" | "isin" | "priceSymbol">, query: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = norm(query.trim());
  if (!q) return false;
  return [asset.name, asset.isin ?? "", asset.priceSymbol ?? ""].some((v) => norm(v).includes(q));
}

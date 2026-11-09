import Papa from "papaparse";
import { parseDmy, parseDotNumber, parseEsNumber } from "./numbers";

// Exportación "Holdings" de la cartera de Investing.com (es-ES).

/** Moneda de cotización según el mercado de Investing. */
export const MARKET_CURRENCY: Record<string, string> = {
  NASDAQ: "USD",
  NYSE: "USD",
  AMEX: "USD",
  CSE: "DKK",
  LON: "GBX", // peniques
  TSXV: "CAD",
  TSX: "CAD",
  SWX: "CHF",
  STO: "SEK",
  OSL: "NOK",
  HKG: "HKD",
};

export function marketCurrency(market: string): string {
  return MARKET_CURRENCY[market.toUpperCase()] ?? "EUR";
}

export interface InvestingHolding {
  name: string;
  symbol: string;
  market: string;
  quantity: number;
  avgPrice: number | null;
  lastPrice: number | null;
  marketValueEur: number | null;
}

export interface InvestingLot {
  name: string;
  symbol: string;
  market: string;
  openDate: string;
  quantity: number;
  entryPrice: number;
  commissionEur: number;
  closeDate?: string;
  closePrice?: number;
  realizedPnlEur?: number;
}

export interface InvestingExport {
  holdings: InvestingHolding[];
  openLots: InvestingLot[];
  closedLots: InvestingLot[];
  exportedTotals: { marketValueEur: number | null };
}

type Row = string[];

function sectionRows(rows: Row[], title: string): Row[] {
  const start = rows.findIndex((r) => r[0]?.trim() === title);
  if (start < 0) return [];
  const header = rows[start + 1];
  const out: Row[] = [];
  for (let i = start + 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => !c?.trim())) break;
    // Las filas de datos empiezan con una celda vacía
    if (r[0]?.trim()) break;
    out.push(r);
  }
  return out.map((r) => {
    // Devuelve un objeto por nombre de columna (primera aparición)
    const obj: Row = [];
    header.forEach((h, i) => (obj[i] = r[i] ?? ""));
    return obj;
  });
}

function headerIndex(rows: Row[], title: string): Map<string, number> {
  const start = rows.findIndex((r) => r[0]?.trim() === title);
  const map = new Map<string, number>();
  if (start < 0) return map;
  rows[start + 1].forEach((h, i) => {
    if (!map.has(h.trim())) map.set(h.trim(), i);
  });
  return map;
}

export function parseInvestingCsv(text: string): InvestingExport {
  const rows = Papa.parse<Row>(text.replace(/^﻿/, ""), { skipEmptyLines: false }).data;

  const hIdx = headerIndex(rows, "Resumen de posiciones");
  const col = (r: Row, idx: Map<string, number>, name: string) => r[idx.get(name) ?? -1] ?? "";

  const holdings: InvestingHolding[] = sectionRows(rows, "Resumen de posiciones").map((r) => ({
    name: col(r, hIdx, "Nombre").trim(),
    symbol: col(r, hIdx, "Símbolo").trim(),
    market: col(r, hIdx, "Mercado").trim(),
    quantity: parseDotNumber(col(r, hIdx, "Cantidad")) ?? 0,
    avgPrice: parseEsNumber(col(r, hIdx, "Precio medio")),
    lastPrice: parseEsNumber(col(r, hIdx, "Precio actual")),
    marketValueEur: parseEsNumber(col(r, hIdx, "Val. mercado")),
  }));

  const oIdx = headerIndex(rows, "Posiciones abiertas");
  const openLots: InvestingLot[] = sectionRows(rows, "Posiciones abiertas").flatMap((r) => {
    const openDate = parseDmy(col(r, oIdx, "Fecha apertura"));
    const quantity = parseDotNumber(col(r, oIdx, "Cantidad"));
    const entryPrice = parseEsNumber(col(r, oIdx, "Precio entrada"));
    if (!openDate || !quantity || entryPrice == null) return [];
    return [
      {
        name: col(r, oIdx, "Nombre").trim(),
        symbol: col(r, oIdx, "Símbolo").trim(),
        market: col(r, oIdx, "Mercado").trim(),
        openDate,
        quantity,
        entryPrice,
        commissionEur: parseEsNumber(col(r, oIdx, "Comisión")) ?? 0,
      },
    ];
  });

  const cIdx = headerIndex(rows, "Posiciones cerradas");
  const closedLots: InvestingLot[] = sectionRows(rows, "Posiciones cerradas").flatMap((r) => {
    const openDate = parseDmy(col(r, cIdx, "F. apertura"));
    const closeDate = parseDmy(col(r, cIdx, "Fecha cierre"));
    const quantity = parseDotNumber(col(r, cIdx, "Cantidad"));
    const entryPrice = parseEsNumber(col(r, cIdx, "Precio entrada"));
    const closePrice = parseEsNumber(col(r, cIdx, "Precio cierre"));
    if (!openDate || !closeDate || !quantity || entryPrice == null || closePrice == null) return [];
    return [
      {
        name: col(r, cIdx, "Nombre").trim(),
        symbol: col(r, cIdx, "Símbolo").trim(),
        market: col(r, cIdx, "Mercado").trim(),
        openDate,
        quantity,
        entryPrice,
        commissionEur: 0,
        closeDate,
        closePrice,
        realizedPnlEur: parseEsNumber(col(r, cIdx, "B/P neto")) ?? undefined,
      },
    ];
  });

  const totalRow = rows.find((r) => r[0]?.trim() === "Val. mercado");
  return {
    holdings,
    openLots,
    closedLots,
    exportedTotals: { marketValueEur: parseEsNumber(totalRow?.[1]) },
  };
}

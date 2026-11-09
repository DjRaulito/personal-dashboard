import Papa from "papaparse";
import { parseCommaDecimal, parseDmy } from "./numbers";

// ---------------------------------------------------------------------------
// Órdenes de fondos (CSV "Órdenes"): fecha;ISIN;importe;participaciones;estado
// No indica si es suscripción o reembolso: se deduce al conciliar con Investing.
// ---------------------------------------------------------------------------

export interface FundOrder {
  date: string;
  isin: string;
  amountEur: number;
  units: number;
}

export function parseFundOrdersCsv(text: string): FundOrder[] {
  const rows = Papa.parse<string[]>(text.replace(/^﻿/, ""), { delimiter: ";", skipEmptyLines: true }).data;
  return rows.slice(1).flatMap((r) => {
    const [fecha, isin, importe, participaciones, estado] = r.map((c) => c?.trim() ?? "");
    if (!/finalizada/i.test(estado)) return [];
    const date = parseDmy(fecha);
    const amount = Number(importe.replace(/[^\d.]/g, ""));
    const units = parseCommaDecimal(participaciones);
    if (!date || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !amount || !units) return [];
    return [{ date, isin, amountEur: amount, units }];
  });
}

// ---------------------------------------------------------------------------
// Operaciones de valores (Excel "salida.xls", en realidad HTML en ISO-8859-1)
// ---------------------------------------------------------------------------

export type StockOpKind = "buy" | "sell" | "dividend" | "fee" | "split_out" | "split_in" | "other";

export interface StockOperation {
  date: string;
  id: string;
  market: string;
  kind: StockOpKind;
  rawType: string;
  isin: string;
  name: string;
  quantity: number;
  currency: string;
  netPrice: number;
  netAmount: number; // en la divisa de la operación
}

function classify(type: string): StockOpKind {
  const t = type.toUpperCase();
  if (t === "COMPRA" || t.startsWith("SUSCRIPCION") || t === "EQUIPARACION-ALTA" || t === "CONTRASPLIT-ALTA")
    return t === "COMPRA" || t.startsWith("SUSCRIPCION") ? "buy" : "split_in";
  if (t === "VENTA") return "sell";
  if (t === "EQUIPARACION-BAJA" || t === "CONTRASPLIT-BAJA") return "split_out";
  if (t.startsWith("DIVIDENDO")) return "dividend";
  if (t.startsWith("CARGO")) return "fee";
  return "other";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parseStockOperationsHtml(html: string): StockOperation[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, "")).trim(),
    ),
  );
  return rows.flatMap((c) => {
    if (c.length < 11 || !/^\d{4}-\d{2}-\d{2}$/.test(c[0])) return [];
    const [date, , id, market, type, isin, name, qty, currency, price, amount] = c;
    return [
      {
        date,
        id,
        market,
        kind: classify(type),
        rawType: type,
        isin,
        name,
        quantity: Number(qty) || 0,
        currency,
        netPrice: Number(price) || 0,
        netAmount: Number(amount) || 0,
      },
    ];
  });
}

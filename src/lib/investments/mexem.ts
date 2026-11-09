import Papa from "papaparse";

// Historial de transacciones de MEXEM (plataforma de Interactive Brokers), en CSV.
// Filas: "Transaction History,Data,Fecha,Cuenta,Descripción,Tipo,Símbolo,Cantidad,Precio,Divisa,Bruto,Comisión,Neto"

export interface MexemOperation {
  date: string;
  type: "buy" | "sell" | "dividend" | "fee";
  symbol: string; // sin sufijo de mercado (37H.F -> 37H)
  isin: string | null;
  name: string;
  quantity: number;
  price: number | null;
  currency: string;
  netEur: number; // neto en la divisa base (EUR): negativo = sale dinero
}

const num = (v: string | undefined) => {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : null;
};

export const baseSymbol = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/\.[A-Z]{1,2}$/, "");

export function parseMexemCsv(text: string): MexemOperation[] {
  const rows = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true }).data;
  const isinBySymbol = new Map<string, string>();
  const raw: MexemOperation[] = [];
  for (const r of rows) {
    if (r[0] !== "Transaction History" || r[1] !== "Data") continue;
    const [, , date, , description, kind, symbol, qty, price, currency, , , net] = r.map((c) => c?.trim() ?? "");
    const m = description.match(/^([A-Z0-9.]+)\(([A-Z]{2}[A-Z0-9]{9}\d)\)/);
    if (m) isinBySymbol.set(baseSymbol(m[1]), m[2]);
    const type =
      kind === "Buy"
        ? "buy"
        : kind === "Sell"
          ? "sell"
          : kind === "Dividend"
            ? "dividend"
            : /fee/i.test(kind)
              ? "fee"
              : null;
    const netEur = num(net);
    if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date) || netEur == null || !symbol || symbol === "-") continue;
    raw.push({
      date,
      type,
      symbol: baseSymbol(symbol),
      isin: null,
      name: description,
      quantity: Math.abs(num(qty) ?? 0),
      price: num(price),
      currency: currency && currency !== "-" ? currency : "EUR",
      netEur,
    });
  }

  // Las ejecuciones parciales del mismo día y valor se agrupan en una operación
  const grouped = new Map<string, MexemOperation>();
  for (const op of raw) {
    const key = `${op.date}|${op.symbol}|${op.type}`;
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, { ...op });
      continue;
    }
    const qty = prev.quantity + op.quantity;
    prev.price =
      prev.price != null && op.price != null && qty > 0
        ? (prev.price * prev.quantity + op.price * op.quantity) / qty
        : (prev.price ?? op.price);
    prev.quantity = qty;
    prev.netEur += op.netEur;
  }
  return [...grouped.values()]
    .map((op) => ({ ...op, isin: isinBySymbol.get(op.symbol) ?? null, netEur: Math.round(op.netEur * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

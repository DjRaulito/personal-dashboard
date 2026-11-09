import { z } from "zod";
import { parseAmountToCents } from "./money";
import { normalizeText } from "./text";

export const DATE_FORMATS = ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** Cómo leer un extracto de un banco concreto. Se guarda en import_profiles.mapping. */
export const mappingSchema = z.object({
  skipRows: z.number().int().min(0).max(50).default(0),
  hasHeader: z.boolean().default(true),
  dateColumn: z.number().int().min(0),
  dateFormat: z.enum(DATE_FORMATS),
  descriptionColumns: z.array(z.number().int().min(0)).min(1),
  amountMode: z.enum(["single", "split"]),
  amountColumn: z.number().int().min(0).optional(),
  debitColumn: z.number().int().min(0).optional(),
  creditColumn: z.number().int().min(0).optional(),
  decimal: z.enum([",", "."]),
  invertSign: z.boolean().default(false),
});

export type ImportMapping = z.infer<typeof mappingSchema>;

export interface ParsedRow {
  booked_on: string; // YYYY-MM-DD
  description: string;
  amount_cents: number;
}

export interface RowError {
  line: number; // 1-based, como en la hoja
  reason: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): string | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Convierte una fecha de extracto a YYYY-MM-DD. Admite Date y números de serie de Excel. */
export function parseDate(raw: unknown, format: DateFormat): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return validDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    // Serie de Excel: días desde 1899-12-30
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000);
    return validDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof raw !== "string") return null;
  const parts = raw
    .trim()
    .split(/[^\d]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3) return null;
  const [a, b, c] = parts;
  switch (format) {
    case "DD/MM/YYYY":
      return validDate(c, b, a);
    case "DD/MM/YY":
      return validDate(c < 100 ? 2000 + c : c, b, a);
    case "MM/DD/YYYY":
      return validDate(c, a, b);
    case "YYYY-MM-DD":
      return validDate(a, b, c);
  }
}

function cell(row: unknown[], index: number | undefined): unknown {
  if (index === undefined) return undefined;
  const v = row[index];
  return typeof v === "string" ? v.trim() : v;
}

/** Aplica el mapeo a las filas de la hoja y devuelve movimientos y errores por línea. */
export function mapRows(rows: unknown[][], mapping: ImportMapping) {
  const parsed: ParsedRow[] = [];
  const errors: RowError[] = [];
  const start = mapping.skipRows + (mapping.hasHeader ? 1 : 0);

  rows.forEach((row, i) => {
    if (i < start) return;
    const line = i + 1;
    if (row.every((v) => v === null || v === undefined || String(v).trim() === "")) return;

    const booked_on = parseDate(cell(row, mapping.dateColumn), mapping.dateFormat);
    if (!booked_on) return errors.push({ line, reason: "Fecha no válida" });

    const description = mapping.descriptionColumns
      .map((c) => cell(row, c))
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .map(String)
      .join(" · ")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    if (!description) return errors.push({ line, reason: "Concepto vacío" });

    let amount: number | null;
    if (mapping.amountMode === "single") {
      amount = parseAmountToCents(cell(row, mapping.amountColumn), mapping.decimal);
    } else {
      const debitRaw = cell(row, mapping.debitColumn);
      const creditRaw = cell(row, mapping.creditColumn);
      const debit = debitRaw === "" || debitRaw == null ? 0 : parseAmountToCents(debitRaw, mapping.decimal);
      const credit = creditRaw === "" || creditRaw == null ? 0 : parseAmountToCents(creditRaw, mapping.decimal);
      amount = debit === null || credit === null ? null : Math.abs(credit) - Math.abs(debit);
    }
    if (amount === null) return errors.push({ line, reason: "Importe no válido" });
    if (amount === 0) return errors.push({ line, reason: "Importe cero" });

    parsed.push({ booked_on, description, amount_cents: mapping.invertSign ? -amount : amount });
  });

  return { rows: parsed, errors };
}

/**
 * Clave estable de un movimiento importado. El índice de ocurrencia distingue dos
 * movimientos idénticos el mismo día (p. ej. dos cafés iguales).
 */
export function importKeys(rows: ParsedRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.booked_on}|${r.amount_cents}|${normalizeText(r.description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  });
}

const HEADER_HINTS = {
  date: ["FECHA OPERACION", "FECHA", "F. OPERACION", "DATE", "FECHA VALOR"],
  description: ["CONCEPTO", "DESCRIPCION", "MOVIMIENTO", "DETALLE", "DESCRIPTION", "OBSERVACIONES"],
  amount: ["IMPORTE", "CANTIDAD", "AMOUNT", "IMPORTE EUR"],
  debit: ["CARGO", "CARGOS", "DEBE", "GASTO"],
  credit: ["ABONO", "ABONOS", "HABER", "INGRESO"],
};

function findColumn(headers: string[], hints: string[]): number | undefined {
  for (const hint of hints) {
    const i = headers.findIndex((h) => h === hint);
    if (i >= 0) return i;
  }
  for (const hint of hints) {
    const i = headers.findIndex((h) => h.startsWith(hint) || h.includes(hint));
    if (i >= 0) return i;
  }
  return undefined;
}

/** Busca la fila de cabecera en las primeras líneas y propone un mapeo. */
export function guessMapping(rows: unknown[][]): Partial<ImportMapping> {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const headers = rows[r].map((v) => normalizeText(String(v ?? "")));
    const dateColumn = findColumn(headers, HEADER_HINTS.date);
    const description = findColumn(headers, HEADER_HINTS.description);
    if (dateColumn === undefined || description === undefined) continue;

    const amountColumn = findColumn(headers, HEADER_HINTS.amount);
    const debitColumn = findColumn(headers, HEADER_HINTS.debit);
    const creditColumn = findColumn(headers, HEADER_HINTS.credit);
    const split = amountColumn === undefined && debitColumn !== undefined && creditColumn !== undefined;

    // Adivina formato de fecha y decimal con la primera fila de datos
    const sample = rows.slice(r + 1).find((row) => row.some((v) => String(v ?? "").trim()));
    const sampleDate = sample?.[dateColumn];
    const dateFormat: DateFormat =
      typeof sampleDate === "string" && /^\d{4}-/.test(sampleDate.trim()) ? "YYYY-MM-DD" : "DD/MM/YYYY";
    const sampleAmount = String(sample?.[split ? debitColumn! : (amountColumn ?? 0)] ?? "");
    const decimal = /\d\.\d{2}$/.test(sampleAmount.trim()) && !/,\d{2}$/.test(sampleAmount.trim()) ? "." : ",";

    return {
      skipRows: r,
      hasHeader: true,
      dateColumn,
      dateFormat,
      descriptionColumns: [description],
      amountMode: split ? "split" : "single",
      amountColumn: split ? undefined : amountColumn,
      debitColumn: split ? debitColumn : undefined,
      creditColumn: split ? creditColumn : undefined,
      decimal,
      invertSign: false,
    };
  }
  return {};
}

// Lectura de tickets con IA: prompt, esquema y cómo se traduce al formulario (puro, testeable).
import { z } from "zod";

export const receiptSchema = z.object({
  merchant: z.string().max(120).optional().default(""),
  date: z.string().nullable().optional(),
  total: z.coerce.number().min(0).max(100000),
  category: z.string().max(120).nullable().optional(),
  summary: z.string().max(200).optional().default(""),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const SYSTEM_RECEIPT =
  "Lees tickets y facturas españoles. Respondes SIEMPRE con un único objeto JSON válido, sin texto adicional.";

export function receiptPrompt(categories: string[], today: string): string {
  return [
    "Lee el ticket de la foto.",
    "- merchant: nombre del comercio, corto y legible (p. ej. «Mercadona», no la razón social completa).",
    `- date: fecha del ticket en formato YYYY-MM-DD, o null si no se lee. Hoy es ${today}.`,
    "- total: importe TOTAL pagado en euros (número con punto decimal), no la base imponible.",
    "- category: la categoría que mejor encaje, copiada EXACTAMENTE de esta lista, o null si ninguna encaja:",
    ...categories.map((c) => `  · ${c}`),
    "- summary: qué se compró, en 3-8 palabras.",
    'Devuelve: {"merchant": "...", "date": "YYYY-MM-DD" o null, "total": número, "category": "..." o null, "summary": "..."}',
  ].join("\n");
}

export interface ReceiptFill {
  description: string;
  booked_on: string | null;
  amount: string;
  category_id: string | null;
  notes: string;
}

/** Valida lo que ha leído la IA y lo convierte en valores para el formulario de movimiento. */
export function receiptToForm(r: Receipt, categories: { id: string; label: string }[], today: string): ReceiptFill {
  const date = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= today ? r.date : null;
  const norm = (s: string) => s.trim().toLowerCase();
  const wanted = r.category ? norm(r.category) : null;
  const category =
    wanted === null
      ? undefined
      : (categories.find((c) => norm(c.label) === wanted) ??
        categories.find((c) => norm(c.label).endsWith(`› ${wanted}`)));
  return {
    description: r.merchant.trim() || r.summary.trim() || "Ticket",
    booked_on: date,
    amount: r.total.toFixed(2).replace(".", ","),
    category_id: category?.id ?? null,
    notes: r.summary.trim(),
  };
}

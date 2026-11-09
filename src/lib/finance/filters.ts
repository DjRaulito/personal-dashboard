import { z } from "zod";

export const PAGE_SIZE = 50;

/** Filtros del listado de movimientos (vienen de la URL). */
export const transactionFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  cuenta: z.uuid().optional().catch(undefined),
  // id de categoría o "sin" para los no categorizados
  categoria: z
    .union([z.uuid(), z.literal("sin")])
    .optional()
    .catch(undefined),
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  tipo: z.enum(["gastos", "ingresos"]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(10000).optional().catch(undefined),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export function parseFilters(params: Record<string, string | string[] | undefined>): TransactionFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v === "" ? undefined : v]),
  );
  return transactionFiltersSchema.parse(flat);
}

/** Primer y último día (exclusivo) de un mes "YYYY-MM". */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

/** Escapa los comodines de LIKE para buscar texto literal. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** URL con los filtros actuales cambiando algunos valores. */
export function filtersHref(base: string, filters: TransactionFilters, changes: Partial<TransactionFilters>): string {
  const merged = { ...filters, ...changes };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && v !== "" && !(k === "pagina" && v === 1)) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// Tareas programadas: campos que declara cada tarea y validación de sus resultados.
import { z } from "zod";

export const FIELD_TYPES = ["text", "number", "money", "area", "url", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/, "key: minúsculas, números y _"),
  label: z.string().trim().min(1).max(40),
  type: z.enum(FIELD_TYPES).catch("text"),
});
export type TaskField = z.infer<typeof fieldSchema>;

export const fieldsSchema = z.array(fieldSchema).max(20);

export const registerSchema = z.object({
  task: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "task: identificador en minúsculas con guiones"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  schedule: z.string().trim().max(80).default(""),
  fields: fieldsSchema.default([]),
});

const valueFor = (type: FieldType) =>
  type === "number" || type === "money" || type === "area"
    ? z.coerce.number().finite()
    : type === "url"
      ? z.url().max(500)
      : type === "date"
        ? z.iso.date().or(z.iso.datetime())
        : z.string().trim().max(500);

/**
 * Valida los datos de un resultado contra los campos declarados: se quedan solo los campos
 * conocidos y con el tipo correcto; el resto se descarta. Devuelve null si no queda ninguno.
 */
export function cleanItem(fields: TaskField[], data: Record<string, unknown>): Record<string, string | number> | null {
  const out: Record<string, string | number> = {};
  for (const f of fields) {
    if (data[f.key] == null || data[f.key] === "") continue;
    const parsed = valueFor(f.type).safeParse(data[f.key]);
    if (parsed.success) out[f.key] = parsed.data;
  }
  return Object.keys(out).length ? out : null;
}

/** Valor listo para enseñar: 1.250 €, 85 m², fechas cortas… */
export function formatValue(type: FieldType, value: unknown): string {
  if (value == null || value === "") return "—";
  if (type === "money" && typeof value === "number")
    return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  if (type === "area" && typeof value === "number") return `${value.toLocaleString("es-ES")} m²`;
  if (type === "number" && typeof value === "number") return value.toLocaleString("es-ES");
  if (type === "date" && typeof value === "string")
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
  return String(value);
}

export const ITEM_STATUSES = ["new", "favorite", "seen", "discarded"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const STATUS_LABELS: Record<ItemStatus, string> = {
  new: "Nuevos",
  favorite: "Favoritos",
  seen: "Vistos",
  discarded: "Descartados",
};

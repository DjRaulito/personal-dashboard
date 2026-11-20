// Tareas programadas: campos que declara cada tarea y validación de sus resultados.
import { z } from "zod";

export const FIELD_TYPES = ["text", "number", "money", "area", "percent", "boolean", "url", "date"] as const;
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
  view: z.enum(["cards", "table", "days"]).optional(),
});

const valueFor = (type: FieldType) =>
  type === "number" || type === "money" || type === "area" || type === "percent"
    ? z.coerce.number().finite()
    : type === "boolean"
      ? z.union([
          z.boolean(),
          z.enum(["true", "false", "sí", "si", "no"]).transform((v) => v !== "false" && v !== "no"),
        ])
      : type === "url"
        ? z.url().max(500)
        : type === "date"
          ? z.iso.date().or(z.iso.datetime())
          : z.string().trim().max(500);

/**
 * Valida los datos de un resultado contra los campos declarados: se quedan solo los campos
 * conocidos y con el tipo correcto; el resto se descarta. Devuelve null si no queda ninguno.
 */
export function cleanItem(
  fields: TaskField[],
  data: Record<string, unknown>,
): Record<string, string | number | boolean> | null {
  const out: Record<string, string | number | boolean> = {};
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
  if (type === "money" && value === 0) return "Gratis";
  if (type === "money" && typeof value === "number")
    return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  if (type === "area" && typeof value === "number") return `${value.toLocaleString("es-ES")} m²`;
  if (type === "number" && typeof value === "number") return value.toLocaleString("es-ES");
  if (type === "percent" && typeof value === "number")
    return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  if (type === "boolean") return value === true ? "Sí" : "No";
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

// --- Cómo se pinta cada tarea ------------------------------------------------------------------

export const TASK_VIEWS = ["cards", "table", "days"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

const NUMERIC: readonly FieldType[] = ["number", "money", "area", "percent"];

/**
 * Vista según los datos (si la tarea no eligió una): con tres o más cifras se compara mejor en
 * tabla; con fecha, agrupada por día; si no, tarjetas con el precio grande.
 */
export function pickView(fields: TaskField[], chosen?: string | null): TaskView {
  if (chosen && (TASK_VIEWS as readonly string[]).includes(chosen)) return chosen as TaskView;
  if (fields.filter((f) => NUMERIC.includes(f.type)).length >= 3) return "table";
  if (fields.some((f) => f.type === "date")) return "days";
  return "cards";
}

/** Papel de cada campo en la tarjeta: título, cifra grande, enlace, fecha y el resto. */
export function fieldRoles(fields: TaskField[]) {
  const title = fields.find((f) => f.type === "text");
  const price = fields.find((f) => f.type === "money") ?? fields.find((f) => f.type === "number");
  const area = fields.find((f) => f.type === "area");
  return {
    title,
    price,
    area,
    url: fields.find((f) => f.type === "url"),
    date: fields.find((f) => f.type === "date"),
    flags: fields.filter((f) => f.type === "boolean"),
    rest: fields.filter((f) => f !== title && f !== price && f.type !== "url" && f.type !== "boolean"),
  };
}

export interface HistoryPoint {
  at: string;
  data: Record<string, unknown>;
}

/** Histórico guardado por la BD (lo más reciente primero); descarta lo que no tenga forma. */
export function parseHistory(raw: unknown): HistoryPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h) =>
    h && typeof h === "object" && typeof h.at === "string" && h.data && typeof h.data === "object"
      ? [{ at: h.at as string, data: h.data as Record<string, unknown> }]
      : [],
  );
}

/** Cambio de una cifra respecto a la vez anterior que fue distinta (negativo = bajada). */
export function lastChange(
  key: string,
  current: unknown,
  history: HistoryPoint[],
): { delta: number; since: string } | null {
  if (typeof current !== "number") return null;
  for (const h of history) {
    const v = h.data[key];
    if (typeof v === "number" && v !== current) return { delta: current - v, since: h.at };
  }
  return null;
}

/** Valores de una cifra de más antiguo a más reciente, sin repetir seguidos. */
export function valueSeries(key: string, current: unknown, history: HistoryPoint[]): number[] {
  const values = [...history]
    .reverse()
    .map((h) => h.data[key])
    .concat(current)
    .filter((v): v is number => typeof v === "number");
  return values.filter((v, i) => i === 0 || v !== values[i - 1]);
}

/** Agrupa por día (clave YYYY-MM-DD); los días pasados aparte, para ocultarlos. */
export function groupByDay<T>(items: T[], dayOf: (item: T) => string | null, today: string) {
  const groups = new Map<string, T[]>();
  const undated: T[] = [];
  let past = 0;
  for (const item of items) {
    const day = dayOf(item)?.slice(0, 10) ?? null;
    if (!day) {
      undated.push(item);
      continue;
    }
    if (day < today) {
      past++;
      continue;
    }
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return { days: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)), undated, past };
}

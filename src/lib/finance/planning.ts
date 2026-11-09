// Lógica pura de planificación: presupuestos, huchas y pagos recurrentes.
import { normalizeText } from "./text";

// ---------------------------------------------------------------------------
// Fechas (YYYY-MM-DD, calendario sin zona)
// ---------------------------------------------------------------------------

const parse = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
};
const fmt = (date: Date) => date.toISOString().slice(0, 10);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Suma meses conservando el día cuando existe (31 ene + 1 mes = 28/29 feb). */
export function addMonths(date: string, months: number): string {
  const { y, m, day } = parse(date);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth() + 1;
  return fmt(new Date(Date.UTC(ty, tm - 1, Math.min(day, daysInMonth(ty, tm)))));
}

export function addDays(date: string, days: number): string {
  const { y, m, day } = parse(date);
  return fmt(new Date(Date.UTC(y, m - 1, day + days)));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

// ---------------------------------------------------------------------------
// Pagos recurrentes
// ---------------------------------------------------------------------------

export const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

/** Siguiente vencimiento tras `date`. */
export function advanceDue(date: string, frequency: Frequency): string {
  switch (frequency) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "yearly":
      return addMonths(date, 12);
  }
}

/** Equivalente mensual de un importe periódico (céntimos, redondeado). */
export function monthlyEquivalent(amountCents: number, frequency: Frequency): number {
  const factor = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[frequency];
  return Math.round(amountCents * factor);
}

export interface RecurringLike {
  id: string;
  name: string;
  amount_cents: number;
  frequency: Frequency;
  next_due: string;
  active: boolean;
}

/** Vencimientos de cada pago activo entre `from` y `to` (ambos incluidos), ordenados por fecha. */
export function upcomingOccurrences<T extends RecurringLike>(items: T[], from: string, to: string) {
  const out: { item: T; date: string }[] = [];
  for (const item of items) {
    if (!item.active) continue;
    let date = item.next_due;
    // El primer vencimiento se muestra aunque haya quedado atrás (vencido sin marcar)
    for (let i = 0; date <= to && i < 60; i++) {
      if (i === 0 || date >= from) out.push({ item, date });
      date = advanceDue(date, item.frequency);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.item.name.localeCompare(b.item.name));
}

export interface TxLike {
  booked_on: string;
  description: string;
  amount_cents: number;
}

/**
 * ¿Hay un movimiento que corresponda al vencimiento? Busca el patrón en el concepto,
 * mismo signo, importe parecido (±20 %) y fecha cerca del vencimiento.
 */
export function findPayment(
  pattern: string | null,
  amountCents: number,
  due: string,
  frequency: Frequency,
  transactions: TxLike[],
): TxLike | null {
  if (!pattern) return null;
  const needle = normalizeText(pattern);
  const window = frequency === "weekly" ? 3 : 10;
  for (const t of transactions) {
    if (Math.sign(t.amount_cents) !== Math.sign(amountCents)) continue;
    if (Math.abs(daysBetween(due, t.booked_on)) > window) continue;
    if (Math.abs(t.amount_cents - amountCents) > Math.abs(amountCents) * 0.2) continue;
    if (normalizeText(t.description).includes(needle)) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Detección automática de recurrentes en los movimientos
// ---------------------------------------------------------------------------

/** Concepto sin números ni referencias, para agrupar cargos del mismo origen. */
export function merchantKey(description: string): string {
  return normalizeText(description)
    .replace(/\d+/g, " ")
    .replace(/[^A-Z ]/g, " ")
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 4)
    .join(" ");
}

export interface RecurringSuggestion {
  key: string;
  name: string;
  pattern: string;
  amount_cents: number;
  frequency: Frequency;
  next_due: string;
  last_on: string;
  occurrences: number;
  category_id: string | null;
  account_id: string | null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Agrupa movimientos por comercio y propone los que se repiten con un ritmo regular
 * (semanal, mensual, trimestral o anual) y un importe estable.
 */
export function detectRecurring(
  transactions: (TxLike & { category_id?: string | null; account_id?: string | null })[],
  today: string,
): RecurringSuggestion[] {
  const groups = new Map<string, typeof transactions>();
  for (const t of transactions) {
    if (t.amount_cents === 0) continue;
    const key = merchantKey(t.description);
    if (key.length < 3) continue;
    const k = `${key}|${t.amount_cents < 0 ? "-" : "+"}`;
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }

  const out: RecurringSuggestion[] = [];
  for (const [k, list] of groups) {
    // Un cargo por día como mucho (evita duplicados del mismo día)
    const byDay = new Map(list.map((t) => [t.booked_on, t]));
    const rows = [...byDay.values()].sort((a, b) => a.booked_on.localeCompare(b.booked_on));
    if (rows.length < 3) continue;
    const gaps = rows.slice(1).map((t, i) => daysBetween(rows[i].booked_on, t.booked_on));
    const gap = median(gaps);
    const frequency: Frequency | null =
      gap >= 6 && gap <= 8
        ? "weekly"
        : gap >= 26 && gap <= 35
          ? "monthly"
          : gap >= 85 && gap <= 97
            ? "quarterly"
            : gap >= 355 && gap <= 375
              ? "yearly"
              : null;
    if (!frequency) continue;
    // Ritmo regular: la mayoría de huecos cerca de la mediana
    const regular = gaps.filter((g) => Math.abs(g - gap) <= Math.max(4, gap * 0.15)).length;
    if (regular < gaps.length * 0.7) continue;
    // Importe estable: los últimos cargos no se alejan más de un 25 % de la mediana
    const recent = rows.slice(-6);
    const amount = Math.round(median(recent.map((t) => t.amount_cents)));
    const stable = recent.filter((t) => Math.abs(t.amount_cents - amount) <= Math.abs(amount) * 0.25).length;
    if (stable < recent.length * 0.7) continue;
    const last = rows[rows.length - 1];
    let next = advanceDue(last.booked_on, frequency);
    // Si hace más de dos periodos del último cargo, probablemente ya no está activo
    if (daysBetween(last.booked_on, today) > gap * 2 + 10) continue;
    while (next < today) next = advanceDue(next, frequency);
    const key = k.split("|")[0];
    out.push({
      key: k,
      name: titleCase(key),
      pattern: key,
      amount_cents: amount,
      frequency,
      next_due: next,
      last_on: last.booked_on,
      occurrences: rows.length,
      category_id: last.category_id ?? null,
      account_id: last.account_id ?? null,
    });
  }
  return out.sort((a, b) => a.amount_cents - b.amount_cents);
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------------

export type BudgetState = "ok" | "warn" | "over";

/**
 * Estado de un presupuesto en el mes. `elapsed` es la fracción del mes transcurrida (0–1):
 * se avisa si el gasto va por delante del ritmo o supera el 85 %.
 */
export function budgetStatus(limitCents: number, spentCents: number, elapsed: number) {
  const ratio = limitCents > 0 ? spentCents / limitCents : 0;
  const projected = elapsed > 0.05 ? Math.round(spentCents / Math.min(1, elapsed)) : null;
  const state: BudgetState = ratio > 1 ? "over" : ratio >= 0.85 || ratio > elapsed + 0.15 ? "warn" : "ok";
  return { ratio, remaining: limitCents - spentCents, projected, state };
}

/** Fracción del mes transcurrida para un día dado (el día en curso cuenta entero). */
export function monthElapsed(today: string, month: string): number {
  const { y, m, day } = parse(today);
  const key = `${y}-${String(m).padStart(2, "0")}`;
  if (key > month) return 1;
  if (key < month) return 0;
  return day / daysInMonth(y, m);
}

// ---------------------------------------------------------------------------
// Huchas
// ---------------------------------------------------------------------------

/** Progreso de una hucha y aportación mensual necesaria para llegar a la fecha objetivo. */
export function goalProgress(targetCents: number, savedCents: number, targetDate: string | null, today: string) {
  const ratio = targetCents > 0 ? Math.min(1, Math.max(0, savedCents / targetCents)) : 0;
  const missing = Math.max(0, targetCents - savedCents);
  let monthsLeft: number | null = null;
  let perMonth: number | null = null;
  if (targetDate && missing > 0) {
    const days = daysBetween(today, targetDate);
    monthsLeft = Math.max(0, days / 30.44);
    perMonth = monthsLeft >= 1 ? Math.ceil(missing / monthsLeft) : missing;
  }
  return { ratio, missing, monthsLeft, perMonth, done: missing === 0 };
}

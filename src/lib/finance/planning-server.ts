import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, advanceDue, findPayment, upcomingOccurrences, type Frequency, type TxLike } from "./planning";

export interface RecurringRow {
  id: string;
  name: string;
  amount_cents: number;
  frequency: Frequency;
  next_due: string;
  category_id: string | null;
  account_id: string | null;
  match_pattern: string | null;
  active: boolean;
  /** Último cargo reconocido en los movimientos para el periodo ya vencido. */
  paid_on: string | null;
}

export interface GoalRow {
  id: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  account_id: string | null;
  target_date: string | null;
  archived: boolean;
}

export interface BudgetRow {
  id: string;
  category_id: string;
  amount_cents: number;
}

/** Movimientos desde una fecha (paginando de 1000 en 1000, como mucho 10 000). */
export async function transactionsSince(from: string) {
  const supabase = await createClient();
  const out: (TxLike & { category_id: string | null; account_id: string })[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select("booked_on, description, amount_cents, category_id, account_id")
      .gte("booked_on", from)
      .order("booked_on")
      .range(offset, offset + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Vencimiento efectivo: si el cargo del vencimiento guardado ya aparece en los movimientos,
 * se da por pagado y se pasa al siguiente (sin escribir en la BD).
 */
export function effectiveDue(
  r: Omit<RecurringRow, "paid_on">,
  transactions: TxLike[],
  today: string,
): { next_due: string; paid_on: string | null } {
  let due = r.next_due;
  let paidOn: string | null = null;
  for (let i = 0; i < 24 && due <= addDays(today, 10); i++) {
    const hit = findPayment(r.match_pattern, r.amount_cents, due, r.frequency, transactions);
    if (!hit) break;
    paidOn = hit.booked_on;
    due = advanceDue(due, r.frequency);
  }
  return { next_due: due, paid_on: paidOn };
}

export async function getPlanning(today: string) {
  const supabase = await createClient();
  const [budgets, goals, recurring, transactions] = await Promise.all([
    supabase.from("budgets").select("id, category_id, amount_cents"),
    supabase
      .from("savings_goals")
      .select("id, name, target_cents, saved_cents, account_id, target_date, archived")
      .order("created_at"),
    supabase
      .from("recurring_payments")
      .select("id, name, amount_cents, frequency, next_due, category_id, account_id, match_pattern, active")
      .order("next_due"),
    // Algo más de un año para detectar cargos anuales
    transactionsSince(addDays(today, -400)),
  ]);
  if (budgets.error) throw budgets.error;
  if (goals.error) throw goals.error;
  if (recurring.error) throw recurring.error;

  const recurringRows: RecurringRow[] = (recurring.data ?? []).map((r) => {
    const base = { ...r, frequency: r.frequency as Frequency };
    return { ...base, ...(r.active ? effectiveDue(base, transactions, today) : { paid_on: null }) };
  });

  return {
    budgets: (budgets.data ?? []) as BudgetRow[],
    goals: (goals.data ?? []) as GoalRow[],
    recurring: recurringRows,
    transactions,
  };
}

/** Próximos vencimientos para la portada (consulta ligera: solo movimientos recientes). */
export async function getUpcomingPayments(today: string, days = 14) {
  const supabase = await createClient();
  const [{ data, error }, transactions] = await Promise.all([
    supabase
      .from("recurring_payments")
      .select("id, name, amount_cents, frequency, next_due, category_id, account_id, match_pattern, active")
      .eq("active", true),
    transactionsSince(addDays(today, -45)),
  ]);
  if (error) throw error;
  const rows = (data ?? []).map((r) => {
    const base = { ...r, frequency: r.frequency as Frequency };
    return { ...base, ...effectiveDue(base, transactions, today) };
  });
  return { count: rows.length, upcoming: upcomingOccurrences(rows, today, addDays(today, days)) };
}

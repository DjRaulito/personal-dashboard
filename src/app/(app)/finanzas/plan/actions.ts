"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { advanceDue, FREQUENCIES, type Frequency } from "@/lib/finance/planning";
import {
  budgetFormSchema,
  fieldErrors,
  goalFormSchema,
  recurringFormSchema,
  type FormState,
} from "@/lib/finance/schemas";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

function refresh() {
  revalidatePath("/finanzas/plan");
  revalidatePath("/");
}

const id = z.uuid();

// ---------------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------------

export async function saveBudget(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = budgetFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: parsed.data.category_id, amount_cents: parsed.data.amount },
      { onConflict: "user_id,category_id" },
    );
  if (error) return { ok: false, message: "No se pudo guardar el presupuesto." };
  refresh();
  return { ok: true, message: "Presupuesto guardado." };
}

export async function deleteBudget(budgetId: string) {
  const supabase = await session();
  await supabase.from("budgets").delete().eq("id", id.parse(budgetId));
  refresh();
}

// ---------------------------------------------------------------------------
// Huchas
// ---------------------------------------------------------------------------

export async function saveGoal(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = goalFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { id: goalId, target, saved, ...rest } = parsed.data;
  const values = { ...rest, target_cents: target, saved_cents: saved };
  const { error } = goalId
    ? await supabase.from("savings_goals").update(values).eq("id", goalId)
    : await supabase.from("savings_goals").insert(values);
  if (error) return { ok: false, message: "No se pudo guardar la hucha." };
  refresh();
  return { ok: true, message: goalId ? "Hucha actualizada." : "Hucha creada." };
}

/** Suma (o resta) dinero a una hucha sin cuenta enlazada. */
export async function contributeToGoal(goalId: string, cents: number) {
  const amount = z.number().int().min(-1e11).max(1e11).parse(cents);
  const supabase = await session();
  const { data } = await supabase.from("savings_goals").select("saved_cents").eq("id", id.parse(goalId)).single();
  if (!data) return;
  await supabase
    .from("savings_goals")
    .update({ saved_cents: Math.max(0, data.saved_cents + amount) })
    .eq("id", goalId);
  refresh();
}

export async function setGoalArchived(goalId: string, archived: boolean) {
  const supabase = await session();
  await supabase.from("savings_goals").update({ archived }).eq("id", id.parse(goalId));
  refresh();
}

export async function deleteGoal(goalId: string) {
  const supabase = await session();
  await supabase.from("savings_goals").delete().eq("id", id.parse(goalId));
  refresh();
}

// ---------------------------------------------------------------------------
// Pagos recurrentes
// ---------------------------------------------------------------------------

export async function saveRecurring(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = recurringFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { id: recurringId, direction, amount, ...rest } = parsed.data;
  const values = { ...rest, amount_cents: direction === "gasto" ? -amount : amount };
  const { error } = recurringId
    ? await supabase.from("recurring_payments").update(values).eq("id", recurringId)
    : await supabase.from("recurring_payments").insert(values);
  if (error) return { ok: false, message: "No se pudo guardar el pago." };
  refresh();
  return { ok: true, message: recurringId ? "Pago actualizado." : "Pago añadido." };
}

const suggestionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  pattern: z.string().trim().min(2).max(100),
  amount_cents: z
    .number()
    .int()
    .refine((n) => n !== 0 && Math.abs(n) < 1e9),
  frequency: z.enum(FREQUENCIES),
  next_due: z.iso.date(),
  category_id: z.uuid().nullable(),
  account_id: z.uuid().nullable(),
});

/** Da de alta un pago recurrente detectado en los movimientos. */
export async function addSuggestedRecurring(input: z.input<typeof suggestionSchema>) {
  const s = suggestionSchema.parse(input);
  const supabase = await session();
  await supabase.from("recurring_payments").insert({
    name: s.name,
    match_pattern: s.pattern,
    amount_cents: s.amount_cents,
    frequency: s.frequency,
    next_due: s.next_due,
    category_id: s.category_id,
    account_id: s.account_id,
  });
  refresh();
}

/** Marca como pagado el vencimiento `due` (el que se ve en pantalla): pasa al siguiente. */
export async function markRecurringPaid(recurringId: string, due: string) {
  const date = z.iso.date().parse(due);
  const supabase = await session();
  const { data } = await supabase
    .from("recurring_payments")
    .select("frequency")
    .eq("id", id.parse(recurringId))
    .single();
  if (!data) return;
  await supabase
    .from("recurring_payments")
    .update({ next_due: advanceDue(date, data.frequency as Frequency) })
    .eq("id", recurringId);
  refresh();
}

export async function setRecurringActive(recurringId: string, active: boolean) {
  const supabase = await session();
  await supabase.from("recurring_payments").update({ active }).eq("id", id.parse(recurringId));
  refresh();
}

export async function deleteRecurring(recurringId: string) {
  const supabase = await session();
  await supabase.from("recurring_payments").delete().eq("id", id.parse(recurringId));
  refresh();
}

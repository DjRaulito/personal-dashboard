"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { imageSchema } from "@/lib/ai/image";
import { askJson } from "@/lib/ai/llm";
import { runAi, type AiResult } from "@/lib/ai/result";
import { dayKey } from "@/lib/datetime";
import { categoryOptions, type Category } from "@/lib/finance/categories";
import { importHashes } from "@/lib/finance/import-hash";
import { receiptPrompt, receiptSchema, receiptToForm, SYSTEM_RECEIPT, type ReceiptFill } from "@/lib/finance/receipt";
import { categorize, compileRules, type Rule } from "@/lib/finance/rules";
import {
  accountFormSchema,
  categoryFormSchema,
  fieldErrors,
  importSchema,
  ruleFormSchema,
  transactionFormSchema,
  type FormState,
  type ImportInput,
} from "@/lib/finance/schemas";
import { z } from "zod";
import { DRIVE_READ_SCOPE, GoogleAuthError } from "@/lib/google/calendar";
import { getGoogleAccess } from "@/lib/google/server";
import { STATEMENTS_FOLDER, syncStatements } from "@/lib/finance/statements-sync";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/ajustes", "layout");
  revalidatePath("/");
}

const UNIQUE_VIOLATION = "23505";

async function loadRules(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("rules").select("id, pattern, match_type, amount_sign, category_id, priority");
  return compileRules((data ?? []) as Rule[]);
}

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

export async function saveAccount(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = accountFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { supabase } = await session();
  const { id, initial_balance, ...rest } = parsed.data;
  const values = { ...rest, initial_balance_cents: initial_balance };
  const { error } = id
    ? await supabase.from("accounts").update(values).eq("id", id)
    : await supabase.from("accounts").insert(values);
  if (error) {
    return {
      ok: false,
      message:
        error.code === UNIQUE_VIOLATION ? "Ya tienes una cuenta con ese nombre." : "No se pudo guardar la cuenta.",
    };
  }
  refresh();
  return { ok: true, message: id ? "Cuenta actualizada." : "Cuenta creada." };
}

export async function setAccountArchived(id: string, archived: boolean) {
  const { supabase } = await session();
  await supabase.from("accounts").update({ archived }).eq("id", id);
  refresh();
}

export async function deleteAccount(id: string) {
  const { supabase } = await session();
  await supabase.from("accounts").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

export async function saveTransaction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = transactionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { supabase } = await session();
  const { id, direction, amount, ...rest } = parsed.data;
  const amount_cents = direction === "gasto" ? -amount : amount;

  // Sin categoría elegida: probar las reglas
  let category_id = rest.category_id;
  if (!category_id && !id) category_id = categorize(await loadRules(supabase), rest.description, amount_cents);

  const values = { ...rest, category_id, amount_cents };
  const { error } = id
    ? await supabase.from("transactions").update(values).eq("id", id)
    : await supabase.from("transactions").insert({ ...values, source: "manual" });
  if (error) return { ok: false, message: "No se pudo guardar el movimiento." };
  refresh();
  return { ok: true, message: id ? "Movimiento actualizado." : "Movimiento añadido." };
}

/** Lee la foto de un ticket y devuelve los campos para rellenar el formulario (no guarda nada). */
export async function scanReceipt(image: unknown): Promise<AiResult<ReceiptFill>> {
  const { supabase } = await session();
  const img = imageSchema.safeParse(image);
  if (!img.success) return { ok: false, message: "La foto no es válida o es demasiado grande." };
  const { data } = await supabase.from("categories").select("id, name, kind, parent_id");
  const expense = categoryOptions((data ?? []) as Category[]).find((g) => g.kind === "expense")?.options ?? [];
  const today = dayKey(new Date());
  return runAi(async () => {
    const receipt = await askJson(
      receiptSchema,
      SYSTEM_RECEIPT,
      receiptPrompt(
        expense.map((c) => c.label),
        today,
      ),
      img.data,
    );
    return receiptToForm(receipt, expense, today);
  });
}

export async function deleteTransactions(ids: string[]) {
  if (ids.length === 0) return;
  const { supabase } = await session();
  await supabase.from("transactions").delete().in("id", ids.slice(0, 1000));
  refresh();
}

export async function setTransactionsCategory(ids: string[], categoryId: string | null) {
  if (ids.length === 0) return;
  const { supabase } = await session();
  await supabase.from("transactions").update({ category_id: categoryId }).in("id", ids.slice(0, 1000));
  refresh();
}

/** Aplica las reglas a los movimientos sin categoría. Devuelve cuántos se categorizaron. */
export async function applyRulesToUncategorized(): Promise<number> {
  const { supabase } = await session();
  const rules = await loadRules(supabase);
  const updates = new Map<string, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("transactions")
      .select("id, description, amount_cents")
      .is("category_id", null)
      .order("id")
      .range(from, from + 999);
    for (const t of data ?? []) {
      const category = categorize(rules, t.description, t.amount_cents);
      if (category) updates.set(category, [...(updates.get(category) ?? []), t.id]);
    }
    if (!data || data.length < 1000) break;
  }
  let count = 0;
  for (const [category_id, ids] of updates) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase.from("transactions").update({ category_id }).in("id", chunk);
      if (!error) count += chunk.length;
    }
  }
  refresh();
  return count;
}

// ---------------------------------------------------------------------------
// Reglas y categorías
// ---------------------------------------------------------------------------

export async function saveRule(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = ruleFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { supabase } = await session();
  const { apply_now, ...values } = parsed.data;
  const { error } = await supabase.from("rules").insert(values);
  if (error) return { ok: false, message: "No se pudo crear la regla." };
  const applied = apply_now ? await applyRulesToUncategorized() : 0;
  refresh();
  return {
    ok: true,
    message: apply_now ? `Regla creada. ${applied} movimientos categorizados.` : "Regla creada.",
  };
}

export async function deleteRule(id: string) {
  const { supabase } = await session();
  await supabase.from("rules").delete().eq("id", id);
  refresh();
}

export async function saveCategory(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = categoryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { supabase } = await session();
  const { id, ...values } = parsed.data;

  // Una subcategoría hereda el tipo de su categoría principal
  if (values.parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("kind, parent_id")
      .eq("id", values.parent_id)
      .single();
    if (!parent || parent.parent_id) return { ok: false, message: "Solo hay un nivel de subcategorías." };
    values.kind = parent.kind as typeof values.kind;
  }

  const { error } = id
    ? await supabase.from("categories").update({ name: values.name }).eq("id", id)
    : await supabase.from("categories").insert(values);
  if (error) {
    return {
      ok: false,
      message: error.code === UNIQUE_VIOLATION ? "Ya existe una categoría con ese nombre." : "No se pudo guardar.",
    };
  }
  refresh();
  return { ok: true, message: id ? "Categoría renombrada." : "Categoría creada." };
}

export async function deleteCategory(id: string) {
  const { supabase } = await session();
  // Los movimientos quedan sin categoría; sus reglas y subcategorías se borran
  await supabase.from("categories").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

export interface ImportResult {
  ok: boolean;
  message?: string;
  inserted?: number;
  duplicates?: number;
  categorized?: number;
}

export async function importTransactions(input: ImportInput): Promise<ImportResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const { accountId, rows, profileName, mapping } = parsed.data;
  const { supabase } = await session();

  const { data: account } = await supabase.from("accounts").select("id").eq("id", accountId).maybeSingle();
  if (!account) return { ok: false, message: "La cuenta no existe." };

  const rules = await loadRules(supabase);
  const hashes = importHashes(accountId, rows);
  const records = rows.map((r, i) => ({
    ...r,
    account_id: accountId,
    source: "import",
    import_hash: hashes[i],
    category_id: categorize(rules, r.description, r.amount_cents),
  }));

  let inserted = 0;
  let categorized = 0;
  for (let i = 0; i < records.length; i += 500) {
    const { data, error } = await supabase
      .from("transactions")
      .upsert(records.slice(i, i + 500), { onConflict: "user_id,account_id,import_hash", ignoreDuplicates: true })
      .select("category_id");
    if (error) {
      console.error("[importar]", error.code, error.message);
      return { ok: false, message: `Error al guardar (llevaba ${inserted} importados).`, inserted };
    }
    inserted += data.length;
    categorized += data.filter((d) => d.category_id).length;
  }

  if (profileName && mapping) {
    await supabase
      .from("import_profiles")
      .upsert({ name: profileName, account_id: accountId, mapping }, { onConflict: "user_id,name" });
  }

  refresh();
  return { ok: true, inserted, duplicates: records.length - inserted, categorized };
}

// ---------------------------------------------------------------------------
// Extractos de Drive, casas de apuestas y salario
// ---------------------------------------------------------------------------

export interface StatementsSyncResult {
  ok: boolean;
  message: string;
}

/** «Sincronizar extractos»: lee los PDF nuevos de la carpeta «Extractos» de Drive. */
export async function syncBankStatements(): Promise<StatementsSyncResult> {
  const { supabase } = await session();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("archived", false)
    .order("created_at");
  // Los extractos son del BBVA: su cuenta, o la primera cuenta corriente
  const account = (accounts ?? []).find((a) => /bbva/i.test(a.name)) ?? (accounts ?? []).find((a) => a.type === "bank");
  if (!account) return { ok: false, message: "Crea antes la cuenta del BBVA en Ajustes → Finanzas → Cuentas." };

  try {
    const access = await getGoogleAccess();
    if (access.status === "not_configured") return { ok: false, message: "Google no está configurado en la app." };
    if (access.status !== "ok" || !access.scopes.includes(DRIVE_READ_SCOPE)) {
      return {
        ok: false,
        message: "Falta el permiso para leer Drive: conecta Google en Ajustes → Conexiones (una sola vez).",
      };
    }
    const r = await syncStatements(supabase, access.accessToken, account.id);
    refresh();
    if (r.files === 0) {
      return { ok: false, message: `No hay PDF en la carpeta «${STATEMENTS_FOLDER}» de tu Drive.` };
    }
    const parts = [
      r.read === 0 ? "No había extractos nuevos." : `${r.read} extractos nuevos, ${r.inserted} movimientos añadidos.`,
    ];
    if (r.failed.length) parts.push(`! No se pudieron leer: ${r.failed.slice(0, 3).join(", ")}.`);
    return { ok: r.failed.length === 0, message: parts.join(" ") };
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      return { ok: false, message: "Google ha caducado el acceso: pulsa «Reconectar» en Ajustes → Conexiones." };
    }
    console.error("[extractos]", e instanceof Error ? e.message : e);
    return { ok: false, message: "No se pudo leer Drive. Inténtalo de nuevo." };
  }
}

const centsInput = z.preprocess(
  (v) => (typeof v === "string" ? Math.round(Number(v.replace(/\./g, "").replace(",", ".").trim()) * 100) : v),
  z.number().int().min(0, "No puede ser negativo").max(100_000_000),
);

/** Saldo apuntado a mano de una casa de apuestas (hoy). */
export async function setManualBalance(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ id: z.uuid(), balance: centsInput })
    .safeParse({ id: formData.get("id"), balance: formData.get("balance") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Importe no válido" };
  const { supabase } = await session();
  const { error } = await supabase
    .from("accounts")
    .update({ manual_balance_cents: parsed.data.balance, manual_balance_on: dayKey(new Date()) })
    .eq("id", parsed.data.id)
    .eq("type", "betting");
  if (error) return { ok: false, message: "No se pudo guardar el saldo." };
  refresh();
  return { ok: true, message: "Saldo actualizado." };
}

/** Salario neto de respaldo (vacío para quitarlo). */
export async function saveMonthlySalary(_: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("salary") ?? "").trim();
  const parsed = raw === "" ? { success: true as const, data: null } : centsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Importe no válido" };
  const { supabase, user } = await session();
  const { error } = await supabase
    .from("profiles")
    .update({ monthly_salary_cents: parsed.data })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: parsed.data == null ? "Salario de respaldo quitado." : "Salario guardado." };
}

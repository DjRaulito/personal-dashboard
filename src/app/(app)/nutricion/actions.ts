"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiUnavailableError, askJson } from "@/lib/ai/llm";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { imageSchema } from "@/lib/ai/image";
import {
  cheatEstimateSchema,
  cheatPhotoPrompt,
  cheatPhotoSchema,
  cheatPrompt,
  foodEstimateSchema,
  foodPrompt,
  mealPrompt,
  mealSuggestionSchema,
  priceEstimateSchema,
  pricePrompt,
  resolveProposals,
  SYSTEM_NUTRITION,
  type CheatEstimate,
  type CheatPhotoEstimate,
  type FoodEstimate,
  type ResolvedProposal,
} from "@/lib/nutrition/ai";
import catalog from "@/lib/nutrition/catalog.json";
import { GoogleAuthError, SHEETS_READ_SCOPE } from "@/lib/google/calendar";
import { getGoogleAccess } from "@/lib/google/server";
import { readSpreadsheet, SheetAccessError } from "@/lib/google/sheets";
import { FOOD_CATEGORIES, GROUP_KINDS, inferCategory } from "@/lib/nutrition/portions";
import { getActivePlan, getDay, getFoods, getNutritionSettings } from "@/lib/nutrition/server";
import { MEASURES, mergeControl, parseSheet, sheetIdFrom, type Measure } from "@/lib/nutrition/sheet";
import { dayKey } from "@/lib/datetime";
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
  revalidatePath("/nutricion", "layout");
  revalidatePath("/");
}

const uuid = z.uuid();
const day = z.iso.date();
const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v.trim().replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), `${label} fuera de rango`);
const requiredNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `Indica ${label}`)
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, `${label} fuera de rango`);

type AiResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function runAi<T>(fn: () => Promise<T>): Promise<AiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AiUnavailableError) return { ok: false, message: e.message };
    return { ok: false, message: e instanceof Error ? e.message : "La IA no está disponible ahora." };
  }
}

// ---------------------------------------------------------------------------
// Checklist del día
// ---------------------------------------------------------------------------

const STATUSES = ["done", "less", "more", "skipped", "cheat"] as const;

export async function setMealCheck(dayKey: string, mealId: string, status: string | null, note?: string) {
  const d = day.parse(dayKey);
  const meal_id = uuid.parse(mealId);
  const supabase = await session();
  if (status === null) {
    await supabase.from("nutrition_meal_checks").delete().eq("day", d).eq("meal_id", meal_id);
  } else {
    await supabase.from("nutrition_meal_checks").upsert(
      {
        day: d,
        meal_id,
        status: z.enum(STATUSES).parse(status),
        note: note ? z.string().max(500).parse(note) : null,
      },
      { onConflict: "user_id,day,meal_id" },
    );
  }
  refresh();
}

/** Marca como «según el plan» todas las comidas del día que aún no tienen estado. */
export async function markRestAsPlanned(dayKey: string): Promise<number> {
  const d = day.parse(dayKey);
  const supabase = await session();
  const [plan, current] = await Promise.all([getActivePlan(), getDay(d)]);
  const pending = (plan?.meals ?? []).filter((m) => !current.checks.has(m.id));
  if (pending.length === 0) return 0;
  const { error } = await supabase.from("nutrition_meal_checks").upsert(
    pending.map((m) => ({ day: d, meal_id: m.id, status: "done" })),
    { onConflict: "user_id,day,meal_id" },
  );
  if (error) throw new Error("No se pudo marcar.");
  refresh();
  return pending.length;
}

// ---------------------------------------------------------------------------
// Chef: platos con IA para una comida del plan
// ---------------------------------------------------------------------------

const chefSchema = z.object({
  mealId: uuid,
  groupIds: z.array(uuid).max(20),
  maxPerGroup: z.number().int().min(1).max(3),
  pins: z.record(uuid, z.array(uuid).max(4)),
  wishes: z.string().max(300).catch(""),
});

/** Propuestas de plato que cuadran las raciones de una comida del plan (no guarda nada). */
export async function chefMeal(input: z.input<typeof chefSchema>): Promise<AiResult<ResolvedProposal[]>> {
  await session();
  const parsed = chefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa lo que has elegido." };
  const { mealId, groupIds, maxPerGroup, pins, wishes } = parsed.data;
  const [plan, foods] = await Promise.all([getActivePlan(), getFoods()]);
  const meal = plan?.meals.find((m) => m.id === mealId);
  if (!meal) return { ok: false, message: "No se encontró la comida en el plan." };
  const wanted = new Set(groupIds);
  const pending = meal.groups
    .filter((g) => wanted.has(g.id) && g.options.length > 0)
    .map((group) => ({ group, remaining: 1 }));
  if (pending.length === 0) return { ok: false, message: "Elige al menos un grupo de la comida." };
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const options = { maxPerGroup, pins, wishes: wishes.trim() };
  return runAi(async () => {
    const suggestion = await askJson(
      mealSuggestionSchema,
      SYSTEM_NUTRITION,
      mealPrompt(meal.name, pending, foodMap, options),
    );
    const resolved = resolveProposals(suggestion, pending, foodMap, options);
    if (resolved.length === 0) throw new Error("La IA no devolvió propuestas válidas. Vuelve a intentarlo.");
    return resolved;
  });
}

// ---------------------------------------------------------------------------
// Alimentos
// ---------------------------------------------------------------------------

const foodSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(uuid.nullable()),
  name: z.string().trim().min(1, "Pon un nombre").max(80),
  kcal: requiredNumber(0, 1000, "las kcal"),
  protein_g: requiredNumber(0, 100, "la proteína"),
  carbs_g: requiredNumber(0, 100, "los hidratos"),
  fat_g: requiredNumber(0, 100, "la grasa"),
  unit_label: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || null),
  unit_grams: optionalNumber(0.1, 5000, "Peso por unidad"),
  cooked_from: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(uuid.nullable()),
  cooked_factor: optionalNumber(0.1, 9.9, "Factor de cocción"),
  category: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.enum(FOOD_CATEGORIES).nullable()),
  price_eur_per_kg: optionalNumber(0, 500, "Precio"),
  source: z.enum(["manual", "ai"]).optional().default("manual"),
});

export async function saveFood(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = foodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { id, price_eur_per_kg, category, ...rest } = parsed.data;
  const values = {
    ...rest,
    category: category ?? inferCategory(rest),
    price_cents_per_kg: price_eur_per_kg === null ? null : Math.round(price_eur_per_kg * 100),
    price_source: price_eur_per_kg === null ? null : "manual",
  };
  if (values.unit_label && !values.unit_grams) {
    return { ok: false, errors: { unit_grams: "Indica cuánto pesa una unidad" } };
  }
  if (Boolean(values.cooked_from) !== Boolean(values.cooked_factor)) {
    return { ok: false, errors: { cooked_factor: "Indica el alimento crudo y el factor (arroz 2,5, pasta 2…)" } };
  }
  if (id && values.cooked_from === id) {
    return { ok: false, errors: { cooked_from: "No puede ser el mismo alimento" } };
  }
  const supabase = await session();
  const { error } = id
    ? await supabase.from("nutrition_foods").update(values).eq("id", id)
    : await supabase.from("nutrition_foods").insert(values);
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Ya tienes un alimento con ese nombre." : "No se pudo guardar.",
    };
  }
  refresh();
  return { ok: true, message: id ? "Alimento actualizado." : "Alimento añadido." };
}

export async function deleteFood(id: string) {
  const supabase = await session();
  const { error } = await supabase.from("nutrition_foods").delete().eq("id", uuid.parse(id));
  if (error) throw new Error("No se pudo borrar.");
  refresh();
}

export async function estimateFood(name: string): Promise<AiResult<FoodEstimate>> {
  await session();
  const clean = z.string().trim().min(2).max(80).safeParse(name);
  if (!clean.success) return { ok: false, message: "Escribe el nombre del alimento." };
  return runAi(() => askJson(foodEstimateSchema, SYSTEM_NUTRITION, foodPrompt(clean.data)));
}

/** Carga los alimentos básicos (los que falten) para empezar. */
export async function loadCatalog() {
  const supabase = await session();
  type Entry = (typeof catalog)[number] & { cooked_from?: string; cooked_factor?: number };
  const entries = catalog as Entry[];
  // Primero los alimentos; después se enlazan los cocidos con su versión en crudo
  await supabase.from("nutrition_foods").upsert(
    entries.map((e) => ({
      name: e.name,
      kcal: e.kcal,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
      unit_label: e.unit_label ?? null,
      unit_grams: e.unit_grams ?? null,
      category: inferCategory(e),
      source: "seed",
    })),
    { onConflict: "user_id,name", ignoreDuplicates: true },
  );
  const { data } = await supabase.from("nutrition_foods").select("id, name, cooked_from");
  const idByName = new Map((data ?? []).map((f) => [f.name, f]));
  for (const e of entries) {
    const cooked = idByName.get(e.name);
    const raw = e.cooked_from ? idByName.get(e.cooked_from) : null;
    if (cooked && raw && !cooked.cooked_from) {
      await supabase
        .from("nutrition_foods")
        .update({ cooked_from: raw.id, cooked_factor: e.cooked_factor })
        .eq("id", cooked.id);
    }
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export async function createPlan(name: string) {
  const supabase = await session();
  const clean = z.string().trim().min(1).max(80).parse(name);
  await supabase.from("nutrition_plans").update({ active: false }).eq("active", true);
  const { error } = await supabase.from("nutrition_plans").insert({ name: clean, active: true });
  if (error) throw new Error("No se pudo crear el plan.");
  refresh();
}

export async function renamePlan(id: string, name: string, notes: string) {
  const supabase = await session();
  await supabase
    .from("nutrition_plans")
    .update({ name: z.string().trim().min(1).max(80).parse(name), notes: z.string().max(4000).parse(notes) || null })
    .eq("id", uuid.parse(id));
  refresh();
}

export async function addMeal(planId: string, name: string, position: number) {
  const supabase = await session();
  await supabase.from("nutrition_plan_meals").insert({
    plan_id: uuid.parse(planId),
    name: z.string().trim().min(1).max(60).parse(name),
    position: z.number().int().min(0).max(100).parse(position),
  });
  refresh();
}

export async function updateMeal(id: string, name: string, position: number) {
  const supabase = await session();
  await supabase
    .from("nutrition_plan_meals")
    .update({
      name: z.string().trim().min(1).max(60).parse(name),
      position: z.number().int().min(0).max(100).parse(position),
    })
    .eq("id", uuid.parse(id));
  refresh();
}

export async function deleteMeal(id: string) {
  const supabase = await session();
  await supabase.from("nutrition_plan_meals").delete().eq("id", uuid.parse(id));
  refresh();
}

export async function addGroup(mealId: string, name: string, kind: string, position: number) {
  const supabase = await session();
  await supabase.from("nutrition_plan_groups").insert({
    meal_id: uuid.parse(mealId),
    name: z.string().trim().min(1).max(60).parse(name),
    kind: z.enum(GROUP_KINDS).parse(kind),
    position: z.number().int().min(0).max(100).parse(position),
  });
  refresh();
}

export async function deleteGroup(id: string) {
  const supabase = await session();
  await supabase.from("nutrition_plan_groups").delete().eq("id", uuid.parse(id));
  refresh();
}

export async function saveOption(input: {
  id?: string;
  group_id: string;
  food_id: string;
  amount: number;
  unit: string;
  position?: number;
}) {
  const o = z
    .object({
      id: uuid.optional(),
      group_id: uuid,
      food_id: uuid,
      amount: z.number().positive().max(99999),
      unit: z.enum(["g", "ml", "ud"]),
      position: z.number().int().min(0).max(100).optional(),
    })
    .parse(input);
  const supabase = await session();
  const { id, ...values } = o;
  const { error } = id
    ? await supabase.from("nutrition_plan_options").update(values).eq("id", id)
    : await supabase.from("nutrition_plan_options").insert(values);
  if (error) throw new Error("No se pudo guardar la opción.");
  refresh();
}

export async function deleteOption(id: string) {
  const supabase = await session();
  await supabase.from("nutrition_plan_options").delete().eq("id", uuid.parse(id));
  refresh();
}

// ---------------------------------------------------------------------------
// Cheat meals
// ---------------------------------------------------------------------------

const cheatSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(uuid.nullable()),
  eaten_on: z.iso.date("Fecha no válida"),
  description: z.string().trim().min(1, "Describe lo que comiste").max(1000),
  kcal: optionalNumber(0, 20000, "Kcal"),
  protein_g: optionalNumber(0, 2000, "Proteína"),
  carbs_g: optionalNumber(0, 2000, "Hidratos"),
  fat_g: optionalNumber(0, 2000, "Grasa"),
  estimated_by: z.enum(["manual", "ai"]).optional().default("manual"),
  ai_notes: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => v || null),
});

export async function saveCheat(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = cheatSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { id, kcal, protein_g, carbs_g, fat_g, ...rest } = parsed.data;
  const r = (v: number | null) => (v === null ? null : Math.round(v));
  const values = { ...rest, kcal: r(kcal), protein_g: r(protein_g), carbs_g: r(carbs_g), fat_g: r(fat_g) };
  const supabase = await session();
  const { error } = id
    ? await supabase.from("nutrition_cheats").update(values).eq("id", id)
    : await supabase.from("nutrition_cheats").insert(values);
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: id ? "Cheat meal actualizado." : "Cheat meal apuntado." };
}

export async function deleteCheat(id: string) {
  const supabase = await session();
  await supabase.from("nutrition_cheats").delete().eq("id", uuid.parse(id));
  refresh();
}

export async function estimateCheat(description: string): Promise<AiResult<CheatEstimate>> {
  await session();
  const clean = z.string().trim().min(3).max(1000).safeParse(description);
  if (!clean.success) return { ok: false, message: "Describe primero lo que comiste." };
  return runAi(() => askJson(cheatEstimateSchema, SYSTEM_NUTRITION, cheatPrompt(clean.data)));
}

/** Kcal y macros a partir de una foto del plato (y lo que se haya escrito como pista). */
export async function estimateCheatPhoto(image: unknown, hint: string): Promise<AiResult<CheatPhotoEstimate>> {
  await session();
  const img = imageSchema.safeParse(image);
  if (!img.success) return { ok: false, message: "La foto no es válida o es demasiado grande." };
  const text = z.string().max(1000).catch("").parse(hint).trim();
  return runAi(() => askJson(cheatPhotoSchema, SYSTEM_NUTRITION, cheatPhotoPrompt(text), img.data));
}

// ---------------------------------------------------------------------------
// Lista de la compra
// ---------------------------------------------------------------------------

/** Días a la semana que se come una opción del plan (0 la quita de la lista). */
export async function setShoppingDays(optionId: string, days: number) {
  const option_id = uuid.parse(optionId);
  const days_per_week = z.number().int().min(0).max(7).parse(days);
  const supabase = await session();
  const { error } =
    days_per_week === 0
      ? await supabase.from("nutrition_shopping_picks").delete().eq("option_id", option_id)
      : await supabase
          .from("nutrition_shopping_picks")
          .upsert({ option_id, days_per_week }, { onConflict: "user_id,option_id" });
  if (error) throw new Error("No se pudo guardar.");
  revalidatePath("/nutricion/compra");
}

/** Precio de un alimento en euros por kilo (null lo borra). */
export async function setFoodPrice(foodId: string, eurPerKg: number | null) {
  const id = uuid.parse(foodId);
  const price = z.number().min(0).max(500).nullable().parse(eurPerKg);
  const supabase = await session();
  const { error } = await supabase
    .from("nutrition_foods")
    .update({
      price_cents_per_kg: price === null ? null : Math.round(price * 100),
      price_source: price === null ? null : "manual",
    })
    .eq("id", id);
  if (error) throw new Error("No se pudo guardar el precio.");
  refresh();
}

/** Precio aproximado con IA de los alimentos indicados que aún no tienen precio. */
export async function estimatePrices(foodIds: string[]): Promise<AiResult<number>> {
  const ids = new Set(z.array(uuid).min(1).max(80).parse(foodIds));
  const supabase = await session();
  const foods = (await getFoods()).filter((f) => ids.has(f.id) && (f.price_cents_per_kg ?? null) === null);
  if (foods.length === 0) return { ok: true, data: 0 };
  return runAi(async () => {
    const { prices } = await askJson(priceEstimateSchema, SYSTEM_NUTRITION, pricePrompt(foods.map((f) => f.name)));
    let saved = 0;
    for (const p of prices) {
      const food = foods[p.n];
      if (!food || !(p.eur_per_kg > 0)) continue;
      const { error } = await supabase
        .from("nutrition_foods")
        .update({ price_cents_per_kg: Math.round(p.eur_per_kg * 100), price_source: "ai" })
        .eq("id", food.id)
        .is("price_cents_per_kg", null);
      if (!error) saved += 1;
    }
    if (saved === 0) throw new Error("La IA no devolvió precios. Vuelve a intentarlo.");
    refresh();
    return saved;
  });
}

// ---------------------------------------------------------------------------
// Revisiones: se leen de la hoja de control de la nutricionista (Google Sheets).
// Las medidas se guardan en body_measurements, compartidas con Gimnasio.
// ---------------------------------------------------------------------------

export async function saveReviewSheet(_: FormState, formData: FormData): Promise<FormState> {
  const sheetId = sheetIdFrom(String(formData.get("sheet") ?? ""));
  if (!sheetId) return { ok: false, errors: { sheet: "Pega el enlace de la hoja de cálculo de Google." } };
  const supabase = await session();
  const { error } = await supabase
    .from("nutrition_settings")
    .upsert({ review_sheet_id: sheetId }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: "Hoja guardada. Pulsa «Actualizar» para leerla." };
}

export type SyncResult = { ok: true; added: number; updated: number } | { ok: false; message: string };

/** Vuelve a leer la hoja de control: añade las revisiones nuevas y corrige las medidas que hayan cambiado. */
export async function syncReviews(): Promise<SyncResult> {
  const supabase = await session();
  const { sheetId } = await getNutritionSettings();
  if (!sheetId) return { ok: false, message: "Aún no has indicado cuál es la hoja de control." };

  let tabs: unknown[][][];
  try {
    const access = await getGoogleAccess();
    if (access.status === "not_configured") return { ok: false, message: "Google no está configurado en la app." };
    if (access.status !== "ok" || !access.scopes.includes(SHEETS_READ_SCOPE)) {
      return {
        ok: false,
        message: "Falta el permiso para leer hojas de cálculo: cierra sesión y vuelve a entrar con Google.",
      };
    }
    tabs = await readSpreadsheet(access.accessToken, sheetId);
  } catch (e) {
    if (e instanceof SheetAccessError) return { ok: false, message: e.message };
    if (e instanceof GoogleAuthError) {
      return { ok: false, message: "Google ha rechazado el acceso: cierra sesión y vuelve a entrar." };
    }
    return { ok: false, message: "No se pudo leer la hoja. Inténtalo de nuevo." };
  }

  const entries = mergeControl(
    tabs.map(parseSheet).filter((rows) => rows.length > 0),
    dayKey(new Date()),
  );
  if (entries.length === 0) return { ok: false, message: "No he encontrado revisiones en la hoja." };

  const [measurements, reviews] = await Promise.all([
    supabase
      .from("body_measurements")
      .select(`measured_on, ${MEASURES.join(", ")}`)
      .limit(2000),
    supabase.from("nutrition_reviews").select("review_on, notes").limit(2000),
  ]);
  if (measurements.error || reviews.error) return { ok: false, message: "No se pudieron leer tus revisiones." };
  const current = new Map(
    (measurements.data as unknown as ({ measured_on: string } & Record<Measure, number | null>)[]).map((m) => [
      m.measured_on,
      m,
    ]),
  );
  const notes = new Map(reviews.data.map((r) => [r.review_on, r.notes]));

  let added = 0;
  let updated = 0;
  for (const entry of entries) {
    // Solo se escribe lo que cambia; lo que la hoja no trae (p. ej. % de grasa) no se toca
    const existing = current.get(entry.date);
    const changed: Partial<Record<Measure, number>> = {};
    for (const m of MEASURES) {
      const v = entry.values[m];
      if (v !== undefined && (!existing || existing[m] === null || Number(existing[m]) !== v)) changed[m] = v;
    }
    let touched = false;
    if (Object.keys(changed).length) {
      const { error } = existing
        ? await supabase.from("body_measurements").update(changed).eq("measured_on", entry.date)
        : await supabase.from("body_measurements").insert({ measured_on: entry.date, ...changed });
      if (error) return { ok: false, message: `No se pudieron guardar las medidas del ${entry.date}.` };
      touched = Boolean(existing);
    }
    if (!notes.has(entry.date)) {
      const { error } = await supabase.from("nutrition_reviews").insert({ review_on: entry.date, notes: entry.note });
      if (error) return { ok: false, message: `No se pudo guardar la revisión del ${entry.date}.` };
      added += 1;
    } else {
      if (entry.note && !notes.get(entry.date)) {
        await supabase.from("nutrition_reviews").update({ notes: entry.note }).eq("review_on", entry.date);
        touched = true;
      }
      if (touched) updated += 1;
    }
  }
  await supabase
    .from("nutrition_settings")
    .update({ reviews_synced_at: new Date().toISOString() })
    .not("review_sheet_id", "is", null);
  refresh();
  revalidatePath("/gimnasio/cuerpo");
  return { ok: true, added, updated };
}

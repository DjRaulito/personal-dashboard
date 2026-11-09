"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiUnavailableError, askJson } from "@/lib/ai/llm";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import {
  cheatEstimateSchema,
  cheatPrompt,
  foodEstimateSchema,
  foodPrompt,
  mealPrompt,
  mealSuggestionSchema,
  resolveProposals,
  SYSTEM_NUTRITION,
  type CheatEstimate,
  type FoodEstimate,
  type ResolvedProposal,
} from "@/lib/nutrition/ai";
import catalog from "@/lib/nutrition/catalog.json";
import { GROUP_KINDS, groupProgress } from "@/lib/nutrition/portions";
import { getActivePlan, getDay, getFoods } from "@/lib/nutrition/server";
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
// Registro del día
// ---------------------------------------------------------------------------

const logSchema = z.object({
  day,
  meal_id: uuid.nullable(),
  group_id: uuid.nullable(),
  food_id: uuid,
  grams: z.number().positive().max(9999),
});

export async function addLogs(items: z.input<typeof logSchema>[]) {
  const rows = z.array(logSchema).min(1).max(30).parse(items);
  const supabase = await session();
  const { data, error } = await supabase
    .from("nutrition_logs")
    .insert(rows.map(({ day: eaten_on, ...r }) => ({ ...r, eaten_on })))
    .select("id, meal_id, group_id, food_id, grams");
  if (error) throw new Error("No se pudo apuntar.");
  refresh();
  return (data ?? []).map((l) => ({ ...l, grams: Number(l.grams) }));
}

export async function deleteLog(id: string) {
  const supabase = await session();
  await supabase.from("nutrition_logs").delete().eq("id", uuid.parse(id));
  refresh();
}

export async function clearMealLogs(dayKey: string, mealId: string) {
  const supabase = await session();
  await supabase.from("nutrition_logs").delete().eq("eaten_on", day.parse(dayKey)).eq("meal_id", uuid.parse(mealId));
  refresh();
}

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

/** Propuestas de comida con IA para completar lo que falta de una comida del plan. */
export async function suggestMeal(
  dayKey: string,
  mealId: string,
  wishes: string,
): Promise<AiResult<ResolvedProposal[]>> {
  await session();
  const [plan, foods, dayData] = await Promise.all([getActivePlan(), getFoods(), getDay(day.parse(dayKey))]);
  const meal = plan?.meals.find((m) => m.id === uuid.parse(mealId));
  if (!meal) return { ok: false, message: "No se encontró la comida en el plan." };
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const logs = dayData.logs.filter((l) => l.meal_id === meal.id);
  const pending = meal.groups
    .map((group) => ({ group, remaining: groupProgress(group, logs, foodMap).remaining }))
    .filter((p) => p.remaining > 0.05 && p.group.options.length > 0);
  if (pending.length === 0) return { ok: false, message: "Esta comida ya está completa." };
  return runAi(async () => {
    const suggestion = await askJson(
      mealSuggestionSchema,
      SYSTEM_NUTRITION,
      mealPrompt(
        meal.name,
        pending,
        foodMap,
        z
          .string()
          .max(300)
          .parse(wishes ?? ""),
      ),
    );
    const resolved = resolveProposals(suggestion, pending, foodMap);
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
  source: z.enum(["manual", "ai"]).optional().default("manual"),
});

export async function saveFood(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = foodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { id, ...values } = parsed.data;
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

export async function updateGroup(id: string, name: string, kind: string) {
  const supabase = await session();
  await supabase
    .from("nutrition_plan_groups")
    .update({ name: z.string().trim().min(1).max(60).parse(name), kind: z.enum(GROUP_KINDS).parse(kind) })
    .eq("id", uuid.parse(id));
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

// ---------------------------------------------------------------------------
// Revisiones (las medidas se guardan en body_measurements, compartidas con Gimnasio)
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  review_on: z.iso.date("Fecha no válida"),
  phase: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || null),
  adherence: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5), "Del 1 al 5"),
  notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => v || null),
  weight_kg: optionalNumber(20, 400, "Peso"),
  chest_cm: optionalNumber(30, 250, "Pecho"),
  shoulder_cm: optionalNumber(50, 250, "Hombro"),
  arm_cm: optionalNumber(10, 80, "Brazo"),
  abdomen_cm: optionalNumber(30, 250, "Abdomen"),
  waist_cm: optionalNumber(30, 250, "Cintura"),
  hip_cm: optionalNumber(30, 250, "Cadera"),
  thigh_cm: optionalNumber(20, 120, "Muslo"),
  calf_cm: optionalNumber(15, 80, "Gemelo"),
});

export async function saveReview(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { review_on, phase, adherence, notes, ...measures } = parsed.data;
  const supabase = await session();
  const { error } = await supabase
    .from("nutrition_reviews")
    .upsert({ review_on, phase, adherence, notes }, { onConflict: "user_id,review_on" });
  if (error) return { ok: false, message: "No se pudo guardar la revisión." };
  if (Object.values(measures).some((v) => v !== null)) {
    const { error: mErr } = await supabase
      .from("body_measurements")
      .upsert({ measured_on: review_on, ...measures }, { onConflict: "user_id,measured_on" });
    if (mErr) return { ok: false, message: "Revisión guardada, pero no las medidas." };
  }
  refresh();
  revalidatePath("/gimnasio/cuerpo");
  return { ok: true, message: "Revisión guardada." };
}

export async function deleteReview(id: string) {
  const supabase = await session();
  await supabase.from("nutrition_reviews").delete().eq("id", uuid.parse(id));
  refresh();
}

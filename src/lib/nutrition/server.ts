import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Food, GroupKind, LogEntry, PlanGroup, PlanOption } from "./portions";

export interface PlanMeal {
  id: string;
  name: string;
  position: number;
  notes: string | null;
  groups: (PlanGroup & { position: number; notes: string | null })[];
}

export interface ActivePlan {
  id: string;
  name: string;
  starts_on: string | null;
  notes: string | null;
  meals: PlanMeal[];
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const getFoods = cache(async (): Promise<Food[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nutrition_foods")
    .select("id, name, kcal, protein_g, carbs_g, fat_g, unit_label, unit_grams, cooked_from, cooked_factor")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    ...f,
    kcal: Number(f.kcal),
    protein_g: Number(f.protein_g),
    carbs_g: Number(f.carbs_g),
    fat_g: Number(f.fat_g),
    unit_grams: n(f.unit_grams),
    cooked_factor: n(f.cooked_factor),
  }));
});

/** Plan activo con sus comidas, grupos y opciones, ya ordenados. */
export const getActivePlan = cache(async (): Promise<ActivePlan | null> => {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("nutrition_plans")
    .select("id, name, starts_on, notes")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!plan) return null;
  const { data: meals, error: mErr } = await supabase
    .from("nutrition_plan_meals")
    .select("id, name, position, notes")
    .eq("plan_id", plan.id)
    .order("position");
  if (mErr) throw mErr;
  const mealIds = (meals ?? []).map((m) => m.id);
  const { data: groups, error: gErr } = mealIds.length
    ? await supabase
        .from("nutrition_plan_groups")
        .select("id, meal_id, name, kind, position, notes")
        .in("meal_id", mealIds)
        .order("position")
    : { data: [], error: null };
  if (gErr) throw gErr;
  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: options, error: oErr } = groupIds.length
    ? await supabase
        .from("nutrition_plan_options")
        .select("id, group_id, food_id, amount, unit, position")
        .in("group_id", groupIds)
        .order("position")
    : { data: [], error: null };
  if (oErr) throw oErr;

  const optionsByGroup = new Map<string, PlanOption[]>();
  for (const o of options ?? []) {
    const list = optionsByGroup.get(o.group_id) ?? [];
    list.push({ id: o.id, food_id: o.food_id, amount: Number(o.amount), unit: o.unit as PlanOption["unit"] });
    optionsByGroup.set(o.group_id, list);
  }
  return {
    ...plan,
    meals: (meals ?? []).map((m) => ({
      ...m,
      groups: (groups ?? [])
        .filter((g) => g.meal_id === m.id)
        .map((g) => ({
          id: g.id,
          name: g.name,
          kind: g.kind as GroupKind,
          position: g.position,
          notes: g.notes,
          options: optionsByGroup.get(g.id) ?? [],
        })),
    })),
  };
});

export type MealStatus = "done" | "less" | "more" | "skipped" | "cheat";

export interface DayLog extends LogEntry {
  meal_id: string | null;
}

export async function getDay(day: string) {
  const supabase = await createClient();
  const [logs, checks] = await Promise.all([
    supabase
      .from("nutrition_logs")
      .select("id, meal_id, group_id, food_id, grams")
      .eq("eaten_on", day)
      .order("created_at"),
    supabase.from("nutrition_meal_checks").select("meal_id, status, note").eq("day", day),
  ]);
  if (logs.error) throw logs.error;
  if (checks.error) throw checks.error;
  return {
    logs: (logs.data ?? []).map((l) => ({ ...l, grams: Number(l.grams) })) as DayLog[],
    checks: new Map((checks.data ?? []).map((c) => [c.meal_id, { status: c.status as MealStatus, note: c.note }])),
  };
}

/** Checklist de un rango de días (para cumplimiento entre revisiones). */
export async function getChecks(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nutrition_meal_checks")
    .select("day, meal_id, status")
    .gte("day", from)
    .lte("day", to)
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, status: c.status as MealStatus }));
}

export async function getCheats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nutrition_cheats")
    .select("id, eaten_on, description, kcal, protein_g, carbs_g, fat_g, estimated_by, ai_notes")
    .order("eaten_on", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function getReviews() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nutrition_reviews")
    .select("id, review_on, phase, adherence, notes")
    .order("review_on", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

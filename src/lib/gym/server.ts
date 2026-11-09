import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SetType } from "./hevy-csv";
import type { MuscleGroup } from "./muscles";
import { localDay, type SetRow, type WorkoutRow } from "./stats";

export interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  muscle_group_manual: boolean;
}

export interface FullSetRow extends SetRow {
  exercise_index: number;
  set_index: number;
  rpe: number | null;
  superset_id: number | null;
  exercise_notes: string | null;
}

const SET_FIELDS =
  "workout_id, exercise_id, exercise_index, set_index, set_type, weight_kg, reps, distance_m, duration_s, rpe, superset_id, exercise_notes";

/** Lee todas las filas de una consulta en páginas de 1000, en paralelo. */
async function fetchAll<T>(
  count: number,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(count / 1000) }, (_, i) => page(i * 1000, i * 1000 + 999)),
  );
  const out: T[] = [];
  for (const p of pages) {
    if (p.error) throw p.error;
    out.push(...(p.data ?? []));
  }
  return out;
}

const toSet = (s: Record<string, unknown>) =>
  ({
    ...s,
    set_type: s.set_type as SetType,
    weight_kg: s.weight_kg === null ? null : Number(s.weight_kg),
    distance_m: s.distance_m === null ? null : Number(s.distance_m),
    rpe: s.rpe === null ? null : Number(s.rpe),
  }) as FullSetRow;

export const getExercises = cache(async (): Promise<ExerciseRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_exercises")
    .select("id, name, muscle_group, muscle_group_manual")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((e) => ({ ...e, muscle_group: e.muscle_group as MuscleGroup }));
});

export const getWorkouts = cache(async (): Promise<WorkoutRow[]> => {
  const supabase = await createClient();
  const { count } = await supabase.from("gym_workouts").select("id", { count: "exact", head: true });
  return fetchAll<WorkoutRow>(count ?? 0, (from, to) =>
    supabase
      .from("gym_workouts")
      .select("id, title, started_at, ended_at")
      .order("started_at", { ascending: false })
      .range(from, to),
  );
});

/** Series de unos entrenos concretos (pocos: los recientes o uno solo). */
export async function getSetsForWorkouts(ids: string[]): Promise<FullSetRow[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const out: FullSetRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("gym_sets")
      .select(SET_FIELDS)
      .in("workout_id", chunk)
      .order("exercise_index")
      .order("set_index")
      .limit(5000);
    if (error) throw error;
    out.push(...(data ?? []).map(toSet));
  }
  return out;
}

/** Todas las series (para récords). Opcionalmente de un solo ejercicio. */
export const getAllSets = cache(async (exerciseId?: string): Promise<FullSetRow[]> => {
  const supabase = await createClient();
  let countQuery = supabase.from("gym_sets").select("id", { count: "exact", head: true });
  if (exerciseId) countQuery = countQuery.eq("exercise_id", exerciseId);
  const { count } = await countQuery;
  const rows = await fetchAll<Record<string, unknown>>(count ?? 0, (from, to) => {
    let q = supabase.from("gym_sets").select(SET_FIELDS).order("id").range(from, to);
    if (exerciseId) q = q.eq("exercise_id", exerciseId);
    return q;
  });
  return rows.map(toSet);
});

/** Fecha local (YYYY-MM-DD) de cada entreno. */
export function workoutDates(workouts: WorkoutRow[]) {
  return new Map(workouts.map((w) => [w.id, localDay(w.started_at)]));
}

export async function getMeasurements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select(
      "id, measured_on, weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, thigh_cm, shoulder_cm, abdomen_cm, hip_cm, calf_cm, notes",
    )
    .order("measured_on", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const n = (v: number | null) => (v === null ? null : Number(v));
  return (data ?? []).map((m) => ({
    ...m,
    weight_kg: n(m.weight_kg),
    body_fat_pct: n(m.body_fat_pct),
    waist_cm: n(m.waist_cm),
    chest_cm: n(m.chest_cm),
    arm_cm: n(m.arm_cm),
    thigh_cm: n(m.thigh_cm),
    shoulder_cm: n(m.shoulder_cm),
    abdomen_cm: n(m.abdomen_cm),
    hip_cm: n(m.hip_cm),
    calf_cm: n(m.calf_cm),
  }));
}

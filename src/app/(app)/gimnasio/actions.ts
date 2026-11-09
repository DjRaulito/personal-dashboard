"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SET_TYPES } from "@/lib/gym/hevy-csv";
import { guessMuscleGroup, MUSCLE_GROUPS } from "@/lib/gym/muscles";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
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
  revalidatePath("/gimnasio", "layout");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Importación (por lotes desde el navegador)
// ---------------------------------------------------------------------------

const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable();

const workoutSchema = z.object({
  external_id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime().nullable(),
  exercises: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        notes: z.string().max(1000).nullable(),
        superset_id: z.number().int().min(-1000).max(1000).nullable(),
        sets: z
          .array(
            z.object({
              set_index: z.number().int().min(0).max(500),
              set_type: z.enum(SET_TYPES),
              weight_kg: nullableNumber(0, 99999),
              reps: z.number().int().min(0).max(10000).nullable(),
              distance_m: nullableNumber(0, 1e8),
              duration_s: z.number().int().min(0).max(1e7).nullable(),
              rpe: nullableNumber(0, 10),
            }),
          )
          .max(200),
      }),
    )
    .max(100),
});

const batchSchema = z.array(workoutSchema).min(1).max(150);

export type ImportBatchResult =
  { ok: true; workouts: number; sets: number; newExercises: number } | { ok: false; message: string };

export async function importWorkoutBatch(input: unknown): Promise<ImportBatchResult> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "El lote de entrenos no es válido." };
  const workouts = parsed.data;
  const supabase = await session();

  // 1. Ejercicios: crear los que falten (con su grupo muscular deducido)
  const names = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name)))];
  const { data: existing, error: exErr } = await supabase.from("gym_exercises").select("id, name").in("name", names);
  if (exErr) return { ok: false, message: "No se pudieron leer los ejercicios." };
  const idByName = new Map((existing ?? []).map((e) => [e.name, e.id]));
  const missing = names.filter((n) => !idByName.has(n));
  if (missing.length) {
    const { data: created, error } = await supabase
      .from("gym_exercises")
      .insert(missing.map((name) => ({ name, muscle_group: guessMuscleGroup(name) })))
      .select("id, name");
    if (error) return { ok: false, message: "No se pudieron crear los ejercicios." };
    for (const e of created ?? []) idByName.set(e.name, e.id);
  }

  // 2. Entrenos: upsert por huella; reimportar actualiza en vez de duplicar
  const { data: saved, error: wErr } = await supabase
    .from("gym_workouts")
    .upsert(
      workouts.map((w) => ({
        external_id: w.external_id,
        source: "csv",
        title: w.title,
        description: w.description,
        started_at: w.started_at,
        ended_at: w.ended_at,
      })),
      { onConflict: "user_id,external_id" },
    )
    .select("id, external_id");
  if (wErr) return { ok: false, message: "No se pudieron guardar los entrenos." };
  const workoutId = new Map((saved ?? []).map((w) => [w.external_id, w.id]));

  // 3. Series: se sustituyen las de esos entrenos
  const ids = [...workoutId.values()];
  const { error: delErr } = await supabase.from("gym_sets").delete().in("workout_id", ids);
  if (delErr) return { ok: false, message: "No se pudieron actualizar las series." };
  const rows = workouts.flatMap((w) =>
    w.exercises.flatMap((e, exercise_index) =>
      e.sets.map((s) => ({
        workout_id: workoutId.get(w.external_id)!,
        exercise_id: idByName.get(e.name)!,
        exercise_index,
        set_index: s.set_index,
        set_type: s.set_type,
        weight_kg: s.weight_kg,
        reps: s.reps,
        distance_m: s.distance_m,
        duration_s: s.duration_s,
        rpe: s.rpe,
        superset_id: e.superset_id,
        exercise_notes: s.set_index === 0 ? e.notes : null,
      })),
    ),
  );
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from("gym_sets").insert(rows.slice(i, i + 1000));
    if (error) return { ok: false, message: "No se pudieron guardar las series." };
  }
  return { ok: true, workouts: workouts.length, sets: rows.length, newExercises: missing.length };
}

/** Se llama al terminar todos los lotes. */
export async function finishImport() {
  await session();
  refresh();
}

export async function deleteAllWorkouts() {
  const supabase = await session();
  await supabase.from("gym_workouts").delete().not("id", "is", null);
  refresh();
}

// ---------------------------------------------------------------------------
// Ejercicios
// ---------------------------------------------------------------------------

export async function setExerciseMuscle(exerciseId: string, group: string) {
  const id = z.uuid().parse(exerciseId);
  const muscle_group = z.enum(MUSCLE_GROUPS).parse(group);
  const supabase = await session();
  await supabase.from("gym_exercises").update({ muscle_group, muscle_group_manual: true }).eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Medidas corporales
// ---------------------------------------------------------------------------

const measure = (min: number, max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v.trim().replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), `${label} fuera de rango`);

const measurementSchema = z
  .object({
    measured_on: z.iso.date("Fecha no válida"),
    weight_kg: measure(20, 400, "Peso"),
    body_fat_pct: measure(1, 70, "Grasa"),
    waist_cm: measure(30, 250, "Cintura"),
    chest_cm: measure(30, 250, "Pecho"),
    arm_cm: measure(10, 80, "Brazo"),
    thigh_cm: measure(20, 120, "Muslo"),
    notes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .refine((m) => [m.weight_kg, m.body_fat_pct, m.waist_cm, m.chest_cm, m.arm_cm, m.thigh_cm].some((v) => v !== null), {
    message: "Apunta al menos una medida",
    path: ["weight_kg"],
  });

export async function saveMeasurement(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = measurementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { error } = await supabase.from("body_measurements").upsert(parsed.data, { onConflict: "user_id,measured_on" });
  if (error) return { ok: false, message: "No se pudo guardar la medida." };
  refresh();
  return { ok: true, message: "Medida guardada." };
}

export async function deleteMeasurement(measurementId: string) {
  const supabase = await session();
  await supabase.from("body_measurements").delete().eq("id", z.uuid().parse(measurementId));
  refresh();
}

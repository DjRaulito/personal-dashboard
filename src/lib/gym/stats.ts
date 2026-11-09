// Estadísticas de entrenos: 1RM estimado, récords, volumen semanal por grupo y rachas.
import { dayKey } from "@/lib/datetime";
import type { MuscleGroup } from "./muscles";
import type { SetType } from "./hevy-csv";

export interface SetRow {
  workout_id: string;
  exercise_id: string;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_m?: number | null;
  duration_s?: number | null;
}

export interface WorkoutRow {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
}

/** 1RM estimado (Epley). Con más de 12 repeticiones la estimación deja de ser fiable. */
export function estimated1RM(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export const isWorkingSet = (s: { set_type: SetType }) => s.set_type !== "warmup";

/** Kilos movidos (peso × repeticiones) en series efectivas. */
export function setVolume(s: SetRow): number {
  return isWorkingSet(s) && s.weight_kg && s.reps ? s.weight_kg * s.reps : 0;
}

export interface WorkoutSummary {
  durationMin: number | null;
  volumeKg: number;
  sets: number;
  exercises: number;
}

export function summarizeWorkout(w: WorkoutRow, sets: SetRow[]): WorkoutSummary {
  const durationMin = w.ended_at
    ? Math.max(0, Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000))
    : null;
  return {
    durationMin,
    volumeKg: Math.round(sets.reduce((s, x) => s + setVolume(x), 0)),
    sets: sets.filter(isWorkingSet).length,
    exercises: new Set(sets.map((s) => s.exercise_id)).size,
  };
}

export interface ExerciseRecords {
  exercise_id: string;
  maxWeight: { value: number; reps: number; date: string } | null;
  best1RM: { value: number; weight: number; reps: number; date: string } | null;
  bestSetVolume: { value: number; weight: number; reps: number; date: string } | null;
  maxReps: { value: number; date: string } | null;
  sessions: number;
  lastDate: string | null;
}

/** Récords por ejercicio. `dateOf` da la fecha (YYYY-MM-DD) de cada entreno. */
export function exerciseRecords(sets: SetRow[], dateOf: Map<string, string>): Map<string, ExerciseRecords> {
  const out = new Map<string, ExerciseRecords>();
  const sessions = new Map<string, Set<string>>();
  for (const s of sets) {
    const date = dateOf.get(s.workout_id);
    if (!date) continue;
    let r = out.get(s.exercise_id);
    if (!r) {
      r = {
        exercise_id: s.exercise_id,
        maxWeight: null,
        best1RM: null,
        bestSetVolume: null,
        maxReps: null,
        sessions: 0,
        lastDate: null,
      };
      out.set(s.exercise_id, r);
    }
    const seen = sessions.get(s.exercise_id) ?? new Set();
    seen.add(s.workout_id);
    sessions.set(s.exercise_id, seen);
    if (!r.lastDate || date > r.lastDate) r.lastDate = date;
    if (!isWorkingSet(s)) continue;
    const w = s.weight_kg ?? 0;
    const reps = s.reps ?? 0;
    if (
      w > 0 &&
      reps > 0 &&
      (!r.maxWeight || w > r.maxWeight.value || (w === r.maxWeight.value && reps > r.maxWeight.reps))
    ) {
      r.maxWeight = { value: w, reps, date };
    }
    const e1rm = estimated1RM(w, reps);
    if (e1rm && (!r.best1RM || e1rm > r.best1RM.value)) r.best1RM = { value: e1rm, weight: w, reps, date };
    const vol = w * reps;
    if (vol > 0 && (!r.bestSetVolume || vol > r.bestSetVolume.value)) {
      r.bestSetVolume = { value: vol, weight: w, reps, date };
    }
    if (reps > 0 && (!r.maxReps || reps > r.maxReps.value)) r.maxReps = { value: reps, date };
  }
  for (const [id, set] of sessions) out.get(id)!.sessions = set.size;
  return out;
}

/** Evolución por sesión de un ejercicio: mejor 1RM estimado, peso máximo y volumen. */
export function exerciseHistory(sets: SetRow[], dateOf: Map<string, string>) {
  const byWorkout = new Map<
    string,
    { date: string; best1RM: number; maxWeight: number; volume: number; sets: number }
  >();
  for (const s of sets) {
    const date = dateOf.get(s.workout_id);
    if (!date || !isWorkingSet(s)) continue;
    const row = byWorkout.get(s.workout_id) ?? { date, best1RM: 0, maxWeight: 0, volume: 0, sets: 0 };
    row.best1RM = Math.max(row.best1RM, estimated1RM(s.weight_kg, s.reps) ?? 0);
    row.maxWeight = Math.max(row.maxWeight, s.weight_kg ?? 0);
    row.volume += setVolume(s);
    row.sets += 1;
    byWorkout.set(s.workout_id, row);
  }
  return [...byWorkout.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Semanas (lunes a domingo, en hora de Madrid)
// ---------------------------------------------------------------------------

/** Lunes (YYYY-MM-DD) de la semana de una fecha YYYY-MM-DD. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const localDay = (iso: string) => dayKey(new Date(iso));

/**
 * Racha de semanas seguidas con al menos un entreno, contando hacia atrás desde la semana
 * actual. Si esta semana aún no hay entreno, la racha sigue viva desde la anterior.
 */
export function weekStreak(workoutDays: string[], today: string): number {
  const weeks = new Set(workoutDays.map(weekStart));
  let week = weekStart(today);
  if (!weeks.has(week)) week = shiftDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = shiftDays(week, -7);
  }
  return streak;
}

/** Series efectivas por grupo muscular y semana. */
export function weeklySetsByMuscle(
  sets: SetRow[],
  dateOf: Map<string, string>,
  muscleOf: Map<string, MuscleGroup>,
  fromWeek: string,
) {
  const out = new Map<string, Map<MuscleGroup, number>>();
  for (const s of sets) {
    const date = dateOf.get(s.workout_id);
    if (!date || !isWorkingSet(s)) continue;
    const week = weekStart(date);
    if (week < fromWeek) continue;
    const muscle = muscleOf.get(s.exercise_id) ?? "other";
    const row = out.get(week) ?? new Map<MuscleGroup, number>();
    row.set(muscle, (row.get(muscle) ?? 0) + 1);
    out.set(week, row);
  }
  return out;
}

/** Semanas (lunes) desde `from` hasta la de `today`, ambas incluidas. */
export function weeksBetween(from: string, today: string): string[] {
  const out: string[] = [];
  for (let w = weekStart(from); w <= weekStart(today); w = shiftDays(w, 7)) out.push(w);
  return out;
}

export { shiftDays };

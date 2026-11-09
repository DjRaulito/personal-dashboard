// Lector del CSV de entrenos que exporta Hevy (Perfil → Ajustes → Exportar datos).
// Una fila por serie: title, start_time, end_time, description, exercise_title, superset_id,
// exercise_notes, set_index, set_type, weight_kg|weight_lbs, reps, distance_km|distance_miles,
// duration_seconds, rpe. Las fechas vienen en hora local ("9 Nov 2026, 06:15").
import { zonedDateTime } from "@/lib/datetime";

export const SET_TYPES = ["normal", "warmup", "failure", "dropset"] as const;
export type SetType = (typeof SET_TYPES)[number];

export interface ParsedSet {
  set_index: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_m: number | null;
  duration_s: number | null;
  rpe: number | null;
}

export interface ParsedExercise {
  name: string;
  notes: string | null;
  superset_id: number | null;
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  external_id: string;
  title: string;
  description: string | null;
  started_at: string; // ISO UTC
  ended_at: string | null;
  exercises: ParsedExercise[];
}

const MONTHS: Record<string, number> = {
  jan: 1,
  ene: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  sept: 9,
  set: 9,
  oct: 10,
  out: 10,
  nov: 11,
  dec: 12,
  dic: 12,
  dez: 12,
};

/** Fecha de Hevy a ISO UTC. Acepta "9 Nov 2026, 06:15", "9 nov. 2026 6:15", ISO y "2026-11-09 06:15". */
export function parseHevyDate(raw: string | undefined, timeZone?: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // ISO con zona: se respeta
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return zonedDateTime(+m[1], +m[2], +m[3], +m[4], +m[5], timeZone).toISOString();
  m = s.match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(am|pm|a\. ?m\.|p\. ?m\.)?/i);
  if (m) {
    const month =
      MONTHS[m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 4)] ??
      MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!month) return null;
    let hour = +m[4];
    const ampm = m[6]?.toLowerCase().replace(/[ .]/g, "");
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return zonedDateTime(+m[3], month, +m[1], hour, +m[5], timeZone).toISOString();
  }
  return null;
}

const num = (raw: string | undefined): number | null => {
  const s = (raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

function setType(raw: string | undefined): SetType {
  const s = (raw ?? "").trim().toLowerCase();
  if (s.startsWith("warm") || s === "calentamiento") return "warmup";
  if (s.startsWith("fail") || s === "fallo") return "failure";
  if (s.startsWith("drop")) return "dropset";
  return "normal";
}

export class HevyCsvError extends Error {}

/** Convierte las filas del CSV (incluida la cabecera) en entrenos agrupados. */
export function parseHevyCsv(rows: string[][], timeZone?: string): ParsedWorkout[] {
  const headerIndex = rows.findIndex((r) => r.some((c) => c?.trim() === "exercise_title"));
  if (headerIndex === -1) {
    throw new HevyCsvError("No parece el CSV de entrenos de Hevy: falta la columna exercise_title.");
  }
  const header = rows[headerIndex].map((c) => c.trim());
  const col = (name: string) => header.indexOf(name);
  const c = {
    title: col("title"),
    start: col("start_time"),
    end: col("end_time"),
    description: col("description"),
    exercise: col("exercise_title"),
    superset: col("superset_id"),
    notes: col("exercise_notes"),
    setIndex: col("set_index"),
    setType: col("set_type"),
    kg: col("weight_kg"),
    lbs: col("weight_lbs"),
    reps: col("reps"),
    km: col("distance_km"),
    miles: col("distance_miles"),
    seconds: col("duration_seconds"),
    rpe: col("rpe"),
  };
  if (c.start === -1 || c.title === -1) throw new HevyCsvError("Faltan las columnas title o start_time.");

  const workouts = new Map<string, ParsedWorkout>();
  const lastSetIndex = new Map<string, number>();
  for (const row of rows.slice(headerIndex + 1)) {
    const get = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const name = get(c.exercise);
    const started = parseHevyDate(get(c.start), timeZone);
    if (!name || !started) continue;
    const title = get(c.title) || "Entreno";
    const key = started;
    let workout = workouts.get(key);
    if (!workout) {
      workout = {
        external_id: `csv:${started}`,
        title: title.slice(0, 200),
        description: get(c.description).slice(0, 2000) || null,
        started_at: started,
        ended_at: parseHevyDate(get(c.end), timeZone),
        exercises: [],
      };
      workouts.set(key, workout);
    }
    const setIndex = num(get(c.setIndex)) ?? 0;
    // Nuevo ejercicio si cambia el nombre o la numeración de series vuelve a empezar
    let exercise = workout.exercises[workout.exercises.length - 1];
    if (!exercise || exercise.name !== name || setIndex <= (lastSetIndex.get(key) ?? -1)) {
      exercise = {
        name: name.slice(0, 120),
        notes: get(c.notes).slice(0, 1000) || null,
        superset_id: num(get(c.superset)),
        sets: [],
      };
      workout.exercises.push(exercise);
    }
    lastSetIndex.set(key, setIndex);

    const kg = num(get(c.kg)) ?? (c.lbs >= 0 && num(get(c.lbs)) !== null ? num(get(c.lbs))! * 0.45359237 : null);
    const km = num(get(c.km)) ?? (c.miles >= 0 && num(get(c.miles)) !== null ? num(get(c.miles))! * 1.609344 : null);
    const rpe = num(get(c.rpe));
    exercise.sets.push({
      set_index: exercise.sets.length,
      set_type: setType(get(c.setType)),
      weight_kg: kg === null ? null : round(Math.max(0, kg), 2),
      reps: num(get(c.reps)) === null ? null : Math.max(0, Math.round(num(get(c.reps))!)),
      distance_m: km === null ? null : round(Math.max(0, km * 1000), 1),
      duration_s: num(get(c.seconds)) === null ? null : Math.max(0, Math.round(num(get(c.seconds))!)),
      rpe: rpe !== null && rpe >= 0 && rpe <= 10 ? rpe : null,
    });
  }
  return [...workouts.values()].sort((a, b) => a.started_at.localeCompare(b.started_at));
}

import { describe, expect, it } from "vitest";
import { HevyCsvError, parseHevyCsv, parseHevyDate } from "./hevy-csv";
import { guessMuscleGroup } from "./muscles";
import {
  estimated1RM,
  exerciseHistory,
  exerciseRecords,
  summarizeWorkout,
  weekStart,
  weekStreak,
  weeklySetsByMuscle,
  type SetRow,
} from "./stats";

const HEADER = [
  "title",
  "start_time",
  "end_time",
  "description",
  "exercise_title",
  "superset_id",
  "exercise_notes",
  "set_index",
  "set_type",
  "weight_kg",
  "reps",
  "distance_km",
  "duration_seconds",
  "rpe",
];

const row = (o: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => o[h] ?? "");

describe("parseHevyDate", () => {
  it("lee el formato de Hevy en hora de Madrid", () => {
    expect(parseHevyDate("9 Nov 2026, 06:15")).toBe("2026-11-09T05:15:00.000Z");
    expect(parseHevyDate("15 Jul 2026, 18:30")).toBe("2026-07-15T16:30:00.000Z");
    expect(parseHevyDate("3 ene 2026, 7:05")).toBe("2026-01-03T06:05:00.000Z");
    expect(parseHevyDate("9 Nov 2026, 6:15 PM")).toBe("2026-11-09T17:15:00.000Z");
    expect(parseHevyDate("2026-11-09T05:15:45+00:00")).toBe("2026-11-09T05:15:45.000Z");
    expect(parseHevyDate("2026-11-09 06:15:00")).toBe("2026-11-09T05:15:00.000Z");
    expect(parseHevyDate("")).toBeNull();
    expect(parseHevyDate("ayer")).toBeNull();
  });
});

describe("parseHevyCsv", () => {
  const base = { title: "Fullbody", start_time: "6 Nov 2026, 06:20", end_time: "6 Nov 2026, 07:53" };
  const rows = [
    HEADER,
    row({
      ...base,
      exercise_title: "Aducción de Cadera (Máquina)",
      set_index: "0",
      set_type: "warmup",
      weight_kg: "40",
      reps: "10",
    }),
    row({
      ...base,
      exercise_title: "Aducción de Cadera (Máquina)",
      set_index: "1",
      set_type: "normal",
      weight_kg: "85",
      reps: "9",
      rpe: "9.5",
    }),
    row({
      ...base,
      exercise_title: "Curl por detrás de la espalda (Polea)",
      superset_id: "0",
      set_index: "0",
      set_type: "normal",
      weight_kg: "15",
      reps: "10",
    }),
    row({
      ...base,
      exercise_title: "Extensión de Tríceps a un Brazo (Cable)",
      superset_id: "0",
      set_index: "0",
      set_type: "failure",
      weight_kg: "15",
      reps: "9",
    }),
    row({
      ...base,
      exercise_title: "Cinta",
      set_index: "0",
      set_type: "normal",
      distance_km: "2,5",
      duration_seconds: "900",
    }),
    // El mismo ejercicio repetido más tarde en el entreno cuenta como bloque aparte
    row({ ...base, exercise_title: "Cinta", set_index: "0", set_type: "normal", duration_seconds: "300" }),
    row({
      title: "Pecho",
      start_time: "9 Nov 2026, 06:15",
      end_time: "",
      exercise_title: "Press de Banca (Mancuerna)",
      set_index: "0",
      weight_kg: "40",
      reps: "7",
    }),
    row({}),
  ];

  it("agrupa por entreno y ejercicio y convierte unidades", () => {
    const out = parseHevyCsv(rows);
    expect(out).toHaveLength(2);
    const [fullbody, chest] = out;
    expect(fullbody).toMatchObject({
      external_id: "csv:2026-11-06T05:20:00.000Z",
      title: "Fullbody",
      started_at: "2026-11-06T05:20:00.000Z",
      ended_at: "2026-11-06T06:53:00.000Z",
    });
    expect(fullbody.exercises.map((e) => e.name)).toEqual([
      "Aducción de Cadera (Máquina)",
      "Curl por detrás de la espalda (Polea)",
      "Extensión de Tríceps a un Brazo (Cable)",
      "Cinta",
      "Cinta",
    ]);
    expect(fullbody.exercises[0].sets).toEqual([
      { set_index: 0, set_type: "warmup", weight_kg: 40, reps: 10, distance_m: null, duration_s: null, rpe: null },
      { set_index: 1, set_type: "normal", weight_kg: 85, reps: 9, distance_m: null, duration_s: null, rpe: 9.5 },
    ]);
    expect(fullbody.exercises[1].superset_id).toBe(0);
    expect(fullbody.exercises[2].sets[0].set_type).toBe("failure");
    expect(fullbody.exercises[3].sets[0]).toMatchObject({ distance_m: 2500, duration_s: 900 });
    expect(chest.ended_at).toBeNull();
  });

  it("convierte libras y millas", () => {
    const header = HEADER.map((h) => (h === "weight_kg" ? "weight_lbs" : h === "distance_km" ? "distance_miles" : h));
    const out = parseHevyCsv([
      header,
      header.map(
        (h) =>
          ({
            title: "A",
            start_time: "1 Jan 2026, 10:00",
            exercise_title: "Squat",
            set_index: "0",
            set_type: "normal",
            weight_lbs: "225",
            reps: "5",
            distance_miles: "1",
          })[h] ?? "",
      ),
    ]);
    expect(out[0].exercises[0].sets[0]).toMatchObject({ weight_kg: 102.06, distance_m: 1609.3 });
  });

  it("rechaza archivos que no son de Hevy", () => {
    expect(() => parseHevyCsv([["Fecha", "Concepto", "Importe"]])).toThrow(HevyCsvError);
  });
});

describe("guessMuscleGroup", () => {
  it.each([
    ["Elevación Lateral (Máquina)", "shoulders"],
    ["Press de Banca (Mancuerna)", "chest"],
    ["Press de Banca Inclinado (Mancuerna)", "chest"],
    ["Cables Cruzados", "chest"],
    ["Aperturas de Pecho Sentado (Cable)", "chest"],
    ["Aducción de Cadera (Máquina)", "adductors"],
    ["Abducción de Cadera (Máquina)", "abductors"],
    ["Extensión de Pierna Unilateral", "quadriceps"],
    ["Curls de Piernas de Pie", "hamstrings"],
    ["Remo Bajo Iso-Lateral", "back"],
    ["Curl por detrás de la espalda (Polea)", "biceps"],
    ["Extensión de Tríceps a un Brazo (Cable)", "triceps"],
    ["Curl predicador (máquina)", "biceps"],
    ["Jalón de tríceps con cuerda", "triceps"],
    ["Jalón al Pecho (Cable)", "back"],
    ["Vuelos Posteriores (Máquina)", "shoulders"],
    ["Press de Pecho Iso-Lateral (Máquina)", "chest"],
    ["Curl de Bíceps (Barra)", "biceps"],
    ["Sentadilla (Barra)", "quadriceps"],
    ["Peso Muerto Rumano (Barra)", "hamstrings"],
    ["Peso Muerto (Barra)", "back"],
    ["Hip Thrust (Barbell)", "glutes"],
    ["Elevación de Gemelos de Pie", "calves"],
    ["Elevación de Piernas Colgado", "abs"],
    ["Press Militar (Barra)", "shoulders"],
    ["Dominada", "back"],
    ["Cinta de Correr", "cardio"],
    ["Lat Pulldown (Cable)", "back"],
    ["Bench Press (Barbell)", "chest"],
    ["Press de Piernas", "quadriceps"],
    ["Curl de Piernas Acostado (Máquina)", "hamstrings"],
    ["Remo en T", "back"],
    ["Remo Sentado (Máquina)", "back"],
    ["Remo a Un Brazo (Cable)", "back"],
    ["Jalón con cuerda de brazos rectos", "back"],
    ["Jalón de Tríceps en Polea", "triceps"],
    ["Abdominal Corto (Máquina)", "abs"],
    ["Curl Martillo (Cable)", "biceps"],
    ["Vuelos Posteriores a Un Brazo (Cable)", "shoulders"],
    ["Elevaciones De Hombro Maquina", "shoulders"],
    ["Elevación Lateral a un Brazo (Cable)", "shoulders"],
    ["Elevación Frontal (Cable)", "shoulders"],
    ["Belt Squad", "quadriceps"],
    ["Entrenador Elíptico", "cardio"],
    ["JM Press (Barbell)", "triceps"],
    ["Pies a Barra", "abs"],
    ["Press Inclinado En Polea", "chest"],
    ["Rack Pull", "back"],
    ["Rear Kick (Machine)", "glutes"],
    ["Algo raro", "other"],
  ])("%s → %s", (name, group) => {
    expect(guessMuscleGroup(name)).toBe(group);
  });
});

describe("estadísticas", () => {
  const sets: SetRow[] = [
    { workout_id: "w1", exercise_id: "bench", set_type: "warmup", weight_kg: 20, reps: 10 },
    { workout_id: "w1", exercise_id: "bench", set_type: "normal", weight_kg: 40, reps: 7 },
    { workout_id: "w1", exercise_id: "bench", set_type: "normal", weight_kg: 36, reps: 11 },
    { workout_id: "w2", exercise_id: "bench", set_type: "failure", weight_kg: 42, reps: 5 },
    { workout_id: "w2", exercise_id: "curl", set_type: "normal", weight_kg: 15, reps: 15 },
  ];
  const dateOf = new Map([
    ["w1", "2026-11-02"],
    ["w2", "2026-11-09"],
  ]);

  it("estima el 1RM con Epley", () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(40, 7)).toBe(49.3);
    expect(estimated1RM(15, 15)).toBeNull();
    expect(estimated1RM(null, 5)).toBeNull();
  });

  it("resume un entreno sin contar el calentamiento", () => {
    const w = { id: "w1", title: "Pecho", started_at: "2026-11-02T05:00:00Z", ended_at: "2026-11-02T06:30:00Z" };
    expect(
      summarizeWorkout(
        w,
        sets.filter((s) => s.workout_id === "w1"),
      ),
    ).toEqual({
      durationMin: 90,
      volumeKg: 676,
      sets: 2,
      exercises: 1,
    });
  });

  it("calcula récords por ejercicio", () => {
    const bench = exerciseRecords(sets, dateOf).get("bench")!;
    expect(bench.maxWeight).toEqual({ value: 42, reps: 5, date: "2026-11-09" });
    expect(bench.best1RM).toEqual({ value: 49.3, weight: 40, reps: 7, date: "2026-11-02" });
    expect(bench.bestSetVolume).toEqual({ value: 396, weight: 36, reps: 11, date: "2026-11-02" });
    expect(bench.maxReps).toEqual({ value: 11, date: "2026-11-02" });
    expect(bench.sessions).toBe(2);
    expect(bench.lastDate).toBe("2026-11-09");
  });

  it("da la evolución por sesión", () => {
    const h = exerciseHistory(
      sets.filter((s) => s.exercise_id === "bench"),
      dateOf,
    );
    expect(h).toEqual([
      { date: "2026-11-02", best1RM: 49.3, maxWeight: 40, volume: 676, sets: 2 },
      { date: "2026-11-09", best1RM: 49, maxWeight: 42, volume: 210, sets: 1 },
    ]);
  });

  it("cuenta semanas seguidas con entreno", () => {
    expect(weekStart("2026-11-09")).toBe("2026-11-09"); // lunes
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // domingo
    const days = ["2026-10-20", "2026-10-28", "2026-11-03", "2026-11-05"];
    expect(weekStreak(days, "2026-11-09")).toBe(3); // esta semana aún sin entreno: cuenta desde la anterior
    expect(weekStreak([...days, "2026-11-09"], "2026-11-10")).toBe(4);
    expect(weekStreak(["2026-10-01"], "2026-11-10")).toBe(0);
  });

  it("agrupa series efectivas por músculo y semana", () => {
    const muscles = new Map([
      ["bench", "chest" as const],
      ["curl", "biceps" as const],
    ]);
    const out = weeklySetsByMuscle(sets, dateOf, muscles, "2026-11-02");
    expect(Object.fromEntries(out.get("2026-11-02")!)).toEqual({ chest: 2 });
    expect(Object.fromEntries(out.get("2026-11-09")!)).toEqual({ chest: 1, biceps: 1 });
  });
});

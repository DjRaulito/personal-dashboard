import "server-only";
import { createClient } from "@/lib/supabase/server";
import { assistantTools } from "./tools";
import { addDaysIso } from "./assistant";
import { lastWeek, type WeeklyStats } from "./weekly";

type Json = Record<string, unknown>;

/** Datos de la última semana completa, reutilizando las herramientas del asistente. */
export async function getWeeklyData(today: string): Promise<{ stats: WeeklyStats; detail: Json }> {
  const { start, end } = lastWeek(today);
  const tools = assistantTools(today);
  const run = (name: string, args: Json) =>
    tools
      .find((t) => t.name === name)!
      .run(args)
      .then((r) => r as Json)
      .catch(() => null);
  const week = { desde: start, hasta: end };
  const [finance, gym, diet, body] = await Promise.all([
    run("finanzas_resumen", week),
    run("gimnasio_entrenos", week),
    run("nutricion", week),
    // El peso se compara con la medida anterior más reciente (hasta 60 días antes)
    run("cuerpo_y_revisiones", { desde: addDaysIso(start, -60), hasta: end }),
  ]);

  const planMeals = ((diet?.plan as { comidas?: string[] } | null)?.comidas ?? []).length;
  const summary = (diet?.resumen ?? {}) as Record<string, number>;
  const weights = ((body?.medidas ?? []) as { measured_on: string; weight_kg?: number }[])
    .filter((m) => m.weight_kg != null)
    .map((m) => ({ day: m.measured_on, kg: Number(m.weight_kg) }));
  const inWeek = weights.filter((w) => w.day >= start);
  const before = weights.filter((w) => w.day < start);
  const weightKg = inWeek.at(-1)?.kg ?? null;
  const prev = before.at(-1)?.kg ?? null;
  const gastos = finance?.total_gastos_eur;
  const hasMovements = Array.isArray(finance?.meses) && (finance.meses as unknown[]).length > 0;

  const stats: WeeklyStats = {
    start,
    end,
    expenseEur: hasMovements && typeof gastos === "number" ? gastos : null,
    workouts: Number(gym?.numero_entrenos ?? 0),
    sets: Object.values((gym?.series_por_musculo ?? {}) as Record<string, number>).reduce((s, n) => s + n, 0),
    dietRatio: planMeals ? Math.min(1, (summary.segun_plan ?? 0) / (planMeals * 7)) : null,
    mealsMarked: summary.comidas_marcadas ?? 0,
    cheats: ((diet?.cheat_meals ?? []) as unknown[]).length,
    weightKg,
    weightDeltaKg: weightKg !== null && prev !== null ? Math.round((weightKg - prev) * 10) / 10 : null,
  };
  return { stats, detail: { finanzas: finance, gimnasio: gym, nutricion: diet } };
}

export async function getWeeklyComment(weekStart: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_weekly_summaries")
    .select("comment")
    .eq("week_start", weekStart)
    .maybeSingle();
  return data?.comment ?? null;
}

import "server-only";
import { getCalendarEvents } from "@/lib/calendar/server";
import { APP_TIMEZONE, zonedMidnight } from "@/lib/datetime";
import { getPlanning } from "@/lib/finance/planning-server";
import { getAccounts, getCategories } from "@/lib/finance/server";
import { likePattern } from "@/lib/finance/filters";
import { MUSCLE_LABELS } from "@/lib/gym/muscles";
import { getAllSets, getExercises, getMeasurements, getSetsForWorkouts, getWorkouts, workoutDates } from "@/lib/gym/server";
import { exerciseHistory, exerciseRecords, isWorkingSet, summarizeWorkout } from "@/lib/gym/stats";
import { getPortfolio } from "@/lib/investments/server";
import { totalsOf } from "@/lib/nutrition/portions";
import { getActivePlan, getCheats, getChecks, getFoods, getReviews } from "@/lib/nutrition/server";
import { createClient } from "@/lib/supabase/server";
import { addDaysIso, dateRange, RANGE_PARAMS } from "./assistant";
import type { AiTool } from "./llm";

// Herramientas de solo lectura que el asistente puede usar. Todas pasan por el cliente de
// Supabase con la sesión del usuario, así que la RLS limita los datos a los suyos.

const eur = (cents: number) => Math.round(cents) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

function categoryNamer(categories: { id: string; name: string; parent_id: string | null }[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (id: string | null) => {
    if (!id) return "Sin categoría";
    const c = byId.get(id);
    if (!c) return "Sin categoría";
    const parent = c.parent_id ? byId.get(c.parent_id) : null;
    return parent ? `${parent.name} › ${c.name}` : c.name;
  };
}

export function assistantTools(today: string): AiTool[] {
  return [
    {
      name: "finanzas_resumen",
      description:
        "Ingresos, gastos y ahorro por mes y gasto por categoría en un rango de fechas. Úsala para preguntas de cuánto gasta, ahorra o ingresa.",
      parameters: { type: "object", properties: { ...RANGE_PARAMS } },
      run: async (args) => {
        const { from, to } = dateRange(args, today, 90);
        const supabase = await createClient();
        const range = { p_from: from, p_to: addDaysIso(to, 1) };
        const [cash, spending, categories] = await Promise.all([
          supabase.rpc("monthly_cashflow", range),
          supabase.rpc("category_spending", range),
          getCategories(),
        ]);
        if (cash.error) throw cash.error;
        if (spending.error) throw spending.error;
        const name = categoryNamer(categories);
        const meses = (cash.data ?? []).map((m) => ({
          mes: m.month.slice(0, 7),
          ingresos_eur: eur(m.income_cents),
          gastos_eur: eur(m.expense_cents),
          ahorro_eur: eur(m.income_cents - m.expense_cents),
        }));
        return {
          desde: from,
          hasta: to,
          meses,
          total_ingresos_eur: round1(meses.reduce((s, m) => s + m.ingresos_eur, 0)),
          total_gastos_eur: round1(meses.reduce((s, m) => s + m.gastos_eur, 0)),
          gasto_por_categoria: (spending.data ?? [])
            .map((c) => ({ categoria: name(c.category_id), gasto_eur: eur(c.spent_cents) }))
            .sort((a, b) => b.gasto_eur - a.gasto_eur),
          nota: meses.length === 0 ? "No hay movimientos en ese rango." : undefined,
        };
      },
    },
    {
      name: "finanzas_movimientos",
      description:
        "Busca movimientos bancarios concretos por texto del concepto, categoría, tipo y fechas. Devuelve el total y los movimientos más recientes.",
      parameters: {
        type: "object",
        properties: {
          ...RANGE_PARAMS,
          texto: { type: "string", description: "Texto a buscar en el concepto (p. ej. Mercadona)" },
          categoria: { type: "string", description: "Nombre de categoría o subcategoría (p. ej. Restaurantes)" },
          tipo: { type: "string", enum: ["gastos", "ingresos", "todos"] },
          limite: { type: "integer", description: "Cuántos movimientos listar (máx. 50)" },
        },
      },
      run: async (args) => {
        const { from, to } = dateRange(args, today, 365);
        const supabase = await createClient();
        const categories = await getCategories();
        const name = categoryNamer(categories);
        let q = supabase
          .from("transactions")
          .select("booked_on, description, amount_cents, category_id")
          .gte("booked_on", from)
          .lte("booked_on", to)
          .order("booked_on", { ascending: false })
          .limit(1000);
        if (typeof args.texto === "string" && args.texto.trim()) q = q.ilike("description", likePattern(args.texto));
        if (args.tipo === "gastos") q = q.lt("amount_cents", 0);
        if (args.tipo === "ingresos") q = q.gt("amount_cents", 0);
        if (typeof args.categoria === "string" && args.categoria.trim()) {
          const needle = args.categoria.trim().toLowerCase();
          const matched = categories.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c.id);
          const ids = new Set([...matched, ...categories.filter((c) => matched.includes(c.parent_id ?? "")).map((c) => c.id)]);
          if (ids.size === 0) return { error: `No hay ninguna categoría que se llame "${args.categoria}"` };
          q = q.in("category_id", [...ids]);
        }
        const { data, error } = await q;
        if (error) throw error;
        const rows = data ?? [];
        const limit = Math.min(50, Math.max(1, Number(args.limite) || 20));
        return {
          desde: from,
          hasta: to,
          numero_movimientos: rows.length,
          total_eur: eur(rows.reduce((s, r) => s + r.amount_cents, 0)),
          movimientos: rows.slice(0, limit).map((r) => ({
            fecha: r.booked_on,
            concepto: r.description,
            importe_eur: eur(r.amount_cents),
            categoria: name(r.category_id),
          })),
        };
      },
    },
    {
      name: "patrimonio",
      description:
        "Saldo de cada cuenta, cartera de inversiones (valor, coste, plusvalías, rentabilidad por periodos) y evolución del patrimonio neto en los últimos 12 meses.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const supabase = await createClient();
        const [accounts, portfolio, history] = await Promise.all([
          getAccounts(),
          getPortfolio(),
          supabase.rpc("net_worth_by_month", { p_from: addDaysIso(today, -365), p_to: today }),
        ]);
        const names = new Map(portfolio.assets.map((a) => [a.id, a.name]));
        const positions = [...portfolio.positions.values()].filter((p) => p.quantity > 1e-6);
        const portfolioValue = positions.reduce((s, p) => s + p.valueEur, 0);
        const cash = accounts.filter((a) => !a.archived).reduce((s, a) => s + a.balance_cents, 0);
        return {
          cuentas: accounts
            .filter((a) => !a.archived)
            .map((a) => ({ cuenta: a.name, tipo: a.type, saldo_eur: eur(a.balance_cents) })),
          inversiones: positions
            .map((p) => ({
              activo: names.get(p.assetId) ?? p.assetId,
              valor_eur: round1(p.valueEur),
              coste_eur: round1(p.costEur),
              plusvalia_latente_eur: round1(p.valueEur - p.costEur),
              dividendos_eur: round1(p.dividendsEur),
            }))
            .sort((a, b) => b.valor_eur - a.valor_eur),
          rentabilidad_cartera: portfolio.returns.map((r) => ({
            periodo: r.period,
            rentabilidad_pct: r.returnPct === null ? null : round1(r.returnPct * 100),
            ganancia_eur: round1(r.pnlEur),
          })),
          total_cuentas_eur: eur(cash),
          total_inversiones_eur: round1(portfolioValue),
          patrimonio_neto_eur: round1(eur(cash) + portfolioValue),
          patrimonio_cuentas_por_mes: (history.data ?? []).map((m) => ({
            mes: m.month.slice(0, 7),
            eur: eur(m.net_worth_cents),
          })),
          precios_actualizados_el: portfolio.lastPriceDate,
        };
      },
    },
    {
      name: "presupuestos_y_pagos",
      description: "Presupuestos mensuales por categoría, huchas de ahorro y pagos recurrentes con su próximo vencimiento.",
      parameters: { type: "object", properties: {} },
      run: async () => {
        const [planning, categories] = await Promise.all([getPlanning(today), getCategories()]);
        const name = categoryNamer(categories);
        const monthStart = `${today.slice(0, 7)}-01`;
        return {
          presupuestos: planning.budgets.map((b) => ({
            categoria: name(b.category_id),
            presupuesto_eur: eur(b.amount_cents),
            gastado_este_mes_eur: eur(
              -planning.transactions
                .filter(
                  (t) =>
                    t.booked_on >= monthStart &&
                    t.amount_cents < 0 &&
                    (t.category_id === b.category_id ||
                      categories.find((c) => c.id === t.category_id)?.parent_id === b.category_id),
                )
                .reduce((s, t) => s + t.amount_cents, 0),
            ),
          })),
          huchas: planning.goals
            .filter((g) => !g.archived)
            .map((g) => ({
              nombre: g.name,
              objetivo_eur: eur(g.target_cents),
              ahorrado_eur: eur(g.saved_cents),
              fecha_objetivo: g.target_date,
            })),
          pagos_recurrentes: planning.recurring
            .filter((r) => r.active)
            .map((r) => ({
              nombre: r.name,
              importe_eur: eur(r.amount_cents),
              frecuencia: r.frequency,
              proximo: r.next_due,
            })),
        };
      },
    },
    {
      name: "gimnasio_entrenos",
      description:
        "Entrenos de un rango de fechas: fecha, título, duración, series, volumen y ejercicios; y series efectivas por grupo muscular.",
      parameters: { type: "object", properties: { ...RANGE_PARAMS } },
      run: async (args) => {
        const { from, to } = dateRange(args, today, 30, 400);
        const [workouts, exercises] = await Promise.all([getWorkouts(), getExercises()]);
        const dateOf = workoutDates(workouts);
        const inRange = workouts.filter((w) => {
          const d = dateOf.get(w.id)!;
          return d >= from && d <= to;
        });
        const listed = inRange.slice(0, 60);
        const sets = await getSetsForWorkouts(listed.map((w) => w.id));
        const exById = new Map(exercises.map((e) => [e.id, e]));
        const byWorkout = new Map<string, typeof sets>();
        for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s]);
        const muscles = new Map<string, number>();
        for (const s of sets.filter(isWorkingSet)) {
          const m = exById.get(s.exercise_id)?.muscle_group ?? "other";
          const label = MUSCLE_LABELS[m as keyof typeof MUSCLE_LABELS] ?? m;
          muscles.set(label, (muscles.get(label) ?? 0) + 1);
        }
        return {
          desde: from,
          hasta: to,
          numero_entrenos: inRange.length,
          detalle_de: listed.length < inRange.length ? `los ${listed.length} más recientes` : "todos",
          entrenos: listed.map((w) => {
            const ws = byWorkout.get(w.id) ?? [];
            const sum = summarizeWorkout(w, ws);
            return {
              fecha: dateOf.get(w.id),
              titulo: w.title,
              duracion_min: sum.durationMin,
              series: sum.sets,
              volumen_kg: sum.volumeKg,
              ejercicios: [...new Set(ws.map((s) => exById.get(s.exercise_id)?.name ?? "?"))],
            };
          }),
          series_por_musculo: Object.fromEntries([...muscles].sort((a, b) => b[1] - a[1])),
        };
      },
    },
    {
      name: "gimnasio_ejercicio",
      description:
        "Récords (peso máximo, 1RM estimado, más repeticiones) e historial reciente de un ejercicio buscado por nombre (en español o inglés, como en Hevy).",
      parameters: {
        type: "object",
        properties: { nombre: { type: "string", description: "Nombre o parte del nombre del ejercicio" } },
        required: ["nombre"],
      },
      run: async (args) => {
        const needle = String(args.nombre ?? "")
          .trim()
          .toLowerCase();
        if (!needle) return { error: "Falta el nombre del ejercicio" };
        const [exercises, workouts] = await Promise.all([getExercises(), getWorkouts()]);
        const words = needle.split(/\s+/);
        const matches = exercises.filter((e) => words.every((w) => e.name.toLowerCase().includes(w))).slice(0, 4);
        if (matches.length === 0) {
          return {
            error: `No encuentro "${args.nombre}"`,
            ejercicios_parecidos: exercises
              .filter((e) => words.some((w) => w.length > 2 && e.name.toLowerCase().includes(w)))
              .slice(0, 10)
              .map((e) => e.name),
          };
        }
        const dateOf = workoutDates(workouts);
        return Promise.all(
          matches.map(async (e) => {
            const sets = await getAllSets(e.id);
            const rec = exerciseRecords(sets, dateOf).get(e.id);
            const history = exerciseHistory(sets, dateOf);
            return {
              ejercicio: e.name,
              grupo: MUSCLE_LABELS[e.muscle_group],
              sesiones: rec?.sessions ?? 0,
              peso_maximo: rec?.maxWeight,
              mejor_1rm_estimado: rec?.best1RM,
              mas_repeticiones: rec?.maxReps,
              ultimas_sesiones: history.slice(-12).map((h) => ({
                fecha: h.date,
                mejor_1rm: h.best1RM,
                peso_max: h.maxWeight,
                volumen_kg: Math.round(h.volume),
                series: h.sets,
              })),
            };
          }),
        );
      },
    },
    {
      name: "nutricion",
      description:
        "Cumplimiento del plan nutricional por días (comidas hechas, de menos, de más, saltadas, cheat), kcal apuntadas y cheat meals en un rango de fechas. Incluye las comidas del plan activo.",
      parameters: { type: "object", properties: { ...RANGE_PARAMS } },
      run: async (args) => {
        const { from, to } = dateRange(args, today, 14, 400);
        const supabase = await createClient();
        const [plan, checks, cheats, foods, logs] = await Promise.all([
          getActivePlan(),
          getChecks(from, to),
          getCheats(),
          getFoods(),
          supabase
            .from("nutrition_logs")
            .select("eaten_on, food_id, grams")
            .gte("eaten_on", from)
            .lte("eaten_on", to)
            .limit(5000),
        ]);
        if (logs.error) throw logs.error;
        const foodMap = new Map(foods.map((f) => [f.id, f]));
        const mealName = new Map((plan?.meals ?? []).map((m) => [m.id, m.name]));
        const days = new Map<string, Record<string, unknown>>();
        for (const c of checks) {
          const d = days.get(c.day) ?? { fecha: c.day, comidas: {} as Record<string, string> };
          (d.comidas as Record<string, string>)[mealName.get(c.meal_id) ?? "otra"] = c.status;
          days.set(c.day, d);
        }
        const logsByDay = new Map<string, { food_id: string; grams: number }[]>();
        for (const l of logs.data ?? [])
          logsByDay.set(l.eaten_on, [...(logsByDay.get(l.eaten_on) ?? []), { ...l, grams: Number(l.grams) }]);
        for (const [day, list] of logsByDay) {
          const t = totalsOf(list, foodMap);
          const d = days.get(day) ?? { fecha: day, comidas: {} };
          d.kcal_apuntadas = Math.round(t.kcal);
          d.proteina_g = Math.round(t.protein_g);
          days.set(day, d);
        }
        const count = (s: string) => checks.filter((c) => c.status === s).length;
        const cheatsInRange = cheats.filter((c) => c.eaten_on >= from && c.eaten_on <= to);
        return {
          desde: from,
          hasta: to,
          plan: plan ? { nombre: plan.name, comidas: plan.meals.map((m) => m.name) } : null,
          estados: "done = según el plan, less = comió menos, more = comió más, skipped = saltada, cheat = comida libre",
          resumen: {
            comidas_marcadas: checks.length,
            segun_plan: count("done"),
            de_menos: count("less"),
            de_mas: count("more"),
            saltadas: count("skipped"),
            cheat: count("cheat"),
          },
          dias: [...days.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
          cheat_meals: cheatsInRange.map((c) => ({
            fecha: c.eaten_on,
            que: c.description,
            kcal: c.kcal === null ? null : Number(c.kcal),
          })),
        };
      },
    },
    {
      name: "cuerpo_y_revisiones",
      description:
        "Medidas corporales (peso, % grasa, perímetros) y revisiones con la nutricionista (fase, valoración, notas) en un rango de fechas.",
      parameters: { type: "object", properties: { ...RANGE_PARAMS } },
      run: async (args) => {
        const { from, to } = dateRange(args, today, 365, 1500);
        const [measurements, reviews] = await Promise.all([getMeasurements(), getReviews()]);
        const drop = <T extends object>(o: T) =>
          Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== null && k !== "id"));
        return {
          desde: from,
          hasta: to,
          medidas: measurements
            .filter((m) => m.measured_on >= from && m.measured_on <= to)
            .reverse()
            .map(drop),
          revisiones: reviews
            .filter((r) => r.review_on >= from && r.review_on <= to)
            .reverse()
            .map(drop),
        };
      },
    },
    {
      name: "agenda",
      description: "Eventos de Google Calendar entre dos fechas (máximo 62 días).",
      parameters: { type: "object", properties: { ...RANGE_PARAMS } },
      run: async (args) => {
        const { from, to } = dateRange({ desde: args.desde ?? today, hasta: args.hasta }, today, 7, 62);
        const [fy, fm, fd] = from.split("-").map(Number);
        const [ty, tm, td] = to.split("-").map(Number);
        const result = await getCalendarEvents({
          start: zonedMidnight(fy, fm, fd),
          end: zonedMidnight(ty, tm, td + 1),
        });
        if (result.status !== "ok") return { error: "El calendario no está conectado o no responde." };
        const fmt = new Intl.DateTimeFormat("es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: APP_TIMEZONE,
        });
        return {
          desde: from,
          hasta: to,
          eventos: result.events.map((e) => ({
            titulo: e.title,
            cuando: e.allDay ? `${e.start.toISOString().slice(0, 10)} (todo el día)` : fmt.format(e.start),
            lugar: e.location ?? undefined,
          })),
        };
      },
    },
  ];
}

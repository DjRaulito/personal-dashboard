"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Check, Copy, MessageSquareText, SlidersHorizontal } from "lucide-react";
import {
  addLogs,
  clearMealLogs,
  copyFromDay,
  deleteLog,
  parseMealLog,
  setMealCheck,
  suggestMeal,
} from "@/app/(app)/nutricion/actions";
import { PhotoButton } from "@/components/ai/photo-button";
import { buttonClass, inputClass } from "@/components/ui";
import type { ImageInput } from "@/lib/ai/image";
import type { ResolvedMealLog, ResolvedProposal } from "@/lib/nutrition/ai";

// Campos compactos en línea: sin el ancho completo de los formularios normales
const compact = inputClass.replace("w-full ", "");
import {
  groupPortionTotals,
  groupProgress,
  portionOf,
  sumTotals,
  totalsOf,
  type Food,
  type PlanGroup,
} from "@/lib/nutrition/portions";

type Status = "done" | "less" | "more" | "skipped" | "cheat";

export interface TrackerLog {
  id: string;
  meal_id: string | null;
  group_id: string | null;
  food_id: string;
  grams: number;
}

const STATUS_OPTIONS: { value: Status; label: string; className: string }[] = [
  { value: "done", label: "Hecha", className: "bg-nutrition text-ink" },
  { value: "less", label: "Comí menos", className: "bg-attention text-ink" },
  { value: "more", label: "Comí más", className: "bg-attention text-ink" },
  { value: "skipped", label: "Saltada", className: "bg-expense text-ink" },
  { value: "cheat", label: "Cheat", className: "bg-gym text-ink" },
];

const pct = (v: number) => `${Math.round(v * 100)} %`;
const kcal = (v: number) => `${Math.round(v).toLocaleString("es-ES")} kcal`;
const grams = (v: number) => `${Math.round(v).toLocaleString("es-ES")} g`;

function Bar({ value, label }: { value: number; label: string }) {
  const over = value > 1.1;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(value, 1) * 100)}
      className="bg-surface-2 mt-2 h-2 overflow-hidden rounded-full"
    >
      <div
        className={clsx(
          "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
          over ? "bg-attention" : "bg-nutrition",
        )}
        style={{ width: `${Math.max(Math.min(value, 1) * 100, value > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function GroupRow({
  group,
  logs,
  foods,
  foodList,
  onAdd,
  onDelete,
  busy,
}: {
  group: PlanGroup;
  logs: TrackerLog[];
  foods: Map<string, Food>;
  foodList: Food[];
  onAdd: (groupId: string, foodId: string, grams: number) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const [foodId, setFoodId] = useState(group.options[0]?.food_id ?? "");
  const [amount, setAmount] = useState("");
  const [inUnits, setInUnits] = useState(false);
  const progress = groupProgress(group, logs, foods);
  const selected = foods.get(foodId);
  const typed = Number(amount.replace(",", "."));
  const typedGrams = inUnits && selected?.unit_grams ? typed * selected.unit_grams : typed;
  const preview = typedGrams > 0 && foodId ? portionOf(foodId, typedGrams, group, foods) : 0;

  // Alimentos del plan (y sus versiones cocidas) primero; luego el resto
  const planIds = new Set(group.options.map((o) => o.food_id));
  for (const f of foodList) if (f.cooked_from && planIds.has(f.cooked_from)) planIds.add(f.id);
  const planFoods = foodList.filter((f) => planIds.has(f.id));
  const otherFoods = foodList.filter((f) => !planIds.has(f.id));

  const submit = () => {
    if (!(typedGrams > 0) || !foodId) return;
    onAdd(group.id, foodId, Math.round(typedGrams * 10) / 10);
    setAmount("");
  };

  if (group.kind === "veg") {
    return (
      <li className="py-3">
        <p className="text-sm font-medium">{group.name}</p>
        <p className="text-muted text-xs">Libre: verdura u hortalizas al gusto.</p>
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{group.name}</p>
        <p
          className={clsx(
            "text-xs tabular-nums",
            progress.eaten > 1.1 ? "text-attention" : progress.remaining === 0 ? "text-nutrition" : "text-muted",
          )}
        >
          {pct(progress.eaten)}
          {progress.remaining === 0 && progress.eaten <= 1.1 && " · completo"}
        </p>
      </div>
      <Bar value={progress.eaten} label={`${group.name}: ${pct(progress.eaten)}`} />

      {progress.logs.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {progress.logs.map((l) => (
            <li
              key={l.id}
              className="bg-surface-2 flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-xs tabular-nums"
            >
              {grams(l.grams)} {foods.get(l.food_id)?.name ?? "?"}
              <span className="text-muted">· {pct(portionOf(l.food_id, l.grams, group, foods))}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(l.id)}
                aria-label={`Quitar ${foods.get(l.food_id)?.name ?? "alimento"}`}
                className="text-muted hover:text-text hover:bg-border flex h-6 w-6 items-center justify-center rounded-full transition-colors"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {progress.remaining > 0 && group.options.length > 0 && (
        <div className="mt-2 text-xs">
          <p className="text-muted">
            {progress.eaten > 0 ? `Te falta ${pct(progress.remaining)}. ` : ""}Una de estas, o mézclalas:
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {progress.options.map((o) => (
              <li key={o.option.id} className="tabular-nums">
                <button
                  type="button"
                  onClick={() => {
                    setFoodId(o.option.food_id);
                    setInUnits(false);
                    setAmount(String(o.grams));
                  }}
                  className="hover:text-nutrition underline decoration-dotted underline-offset-2 transition-colors"
                  title="Usar esta cantidad"
                >
                  {o.units !== null
                    ? `${o.units.toLocaleString("es-ES")} × ${o.food?.name ?? "?"}`
                    : `${o.option.unit === "ml" ? `${o.grams} ml` : grams(o.grams)} ${o.food?.name ?? "?"}`}
                </button>
                {o.cooked.map((c) => (
                  <span key={c.food.id} className="text-muted">
                    {" "}
                    (≈ {grams(c.grams)} {c.food.name.toLowerCase()})
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`food-${group.id}`}>
          Alimento para {group.name}
        </label>
        <select
          id={`food-${group.id}`}
          value={foodId}
          onChange={(e) => {
            setFoodId(e.target.value);
            setInUnits(false);
          }}
          className={`${compact} w-full py-2 text-xs sm:w-auto sm:max-w-56 sm:min-w-0 sm:flex-1`}
        >
          {planFoods.length > 0 && (
            <optgroup label="Del plan">
              {planFoods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Otros alimentos">
            {otherFoods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </optgroup>
        </select>
        <label className="sr-only" htmlFor={`amount-${group.id}`}>
          Cantidad
        </label>
        <input
          id={`amount-${group.id}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder={inUnits ? "1…" : "60…"}
          className={`${compact} w-20 py-2 text-xs tabular-nums`}
        />
        {selected?.unit_label && selected.unit_grams ? (
          <select
            aria-label="Unidad"
            value={inUnits ? "ud" : "g"}
            onChange={(e) => setInUnits(e.target.value === "ud")}
            className={`${compact} py-2 text-xs`}
          >
            <option value="g">g</option>
            <option value="ud">{selected.unit_label}</option>
          </select>
        ) : (
          <span className="text-muted text-xs">g</span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !(typedGrams > 0)}
          className={`${buttonClass.secondary} py-1.5 text-xs`}
        >
          Apuntar
        </button>
        {preview > 0 && (
          <span className="text-muted text-xs tabular-nums" aria-live="polite">
            = {pct(preview)} de ración
            {progress.remaining > 0 && ` · quedaría ${pct(Math.max(0, progress.remaining - preview))}`}
          </span>
        )}
      </div>
    </li>
  );
}

const linkButton =
  "text-muted hover:text-text inline-flex items-center gap-1.5 rounded-full py-1 text-sm transition-colors duration-150 active:opacity-70 disabled:opacity-50";

/** Texto corto de una opción para el chip: "150 g Pechuga de pollo", "2 × Huevo". */
function optionLabel(o: ReturnType<typeof groupProgress>["options"][number]) {
  const name = o.food?.name ?? "?";
  if (o.units !== null) return `${o.units.toLocaleString("es-ES")} × ${name}`;
  return `${o.option.unit === "ml" ? `${o.grams} ml` : grams(o.grams)} ${name}`;
}

/** Un toque por grupo: cada chip apunta lo que falta con esa opción del plan. */
function QuickGroups({
  groups,
  logs,
  foods,
  busy,
  onAdd,
  onDelete,
}: {
  groups: PlanGroup[];
  logs: TrackerLog[];
  foods: Map<string, Food>;
  busy: boolean;
  onAdd: (items: { group_id: string | null; food_id: string; grams: number }[]) => void;
  onDelete: (id: string) => void;
}) {
  const visible = groups.filter((g) => g.kind !== "veg" && g.options.length > 0);
  const loose = logs.filter((l) => !l.group_id || !visible.some((g) => g.id === l.group_id));
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {visible.map((g) => {
        const p = groupProgress(g, logs, foods);
        const complete = p.remaining < 0.05;
        return (
          <li key={g.id}>
            <p className="flex items-center gap-2 text-xs">
              <span className={clsx("font-medium", complete ? "text-nutrition" : "text-muted")}>{g.name}</span>
              {complete ? (
                <Check aria-label="completo" className="text-nutrition h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                p.eaten > 0 && <span className="text-muted tabular-nums">falta {pct(p.remaining)}</span>
              )}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {p.logs.map((l) => (
                <span
                  key={l.id}
                  className="bg-nutrition/15 text-text flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs tabular-nums"
                >
                  {grams(l.grams)} {foods.get(l.food_id)?.name ?? "?"}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(l.id)}
                    aria-label={`Quitar ${foods.get(l.food_id)?.name ?? "alimento"}`}
                    className="text-muted hover:text-text hover:bg-border flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </span>
              ))}
              {!complete &&
                p.options.map((o) => (
                  <button
                    key={o.option.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onAdd([{ group_id: g.id, food_id: o.option.food_id, grams: o.grams }])}
                    className="border-border-strong hover:border-nutrition hover:text-text text-muted rounded-full border px-3 py-1 text-xs tabular-nums transition-[border-color,color,transform] duration-150 active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100"
                  >
                    + {optionLabel(o)}
                  </button>
                ))}
            </div>
          </li>
        );
      })}
      {loose.length > 0 && (
        <li className="flex flex-wrap gap-1.5">
          {loose.map((l) => (
            <span key={l.id} className="bg-surface-2 flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs">
              {grams(l.grams)} {foods.get(l.food_id)?.name ?? "?"}
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(l.id)}
                aria-label={`Quitar ${foods.get(l.food_id)?.name ?? "alimento"}`}
                className="text-muted hover:text-text hover:bg-border flex h-6 w-6 items-center justify-center rounded-full transition-colors"
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          ))}
        </li>
      )}
    </ul>
  );
}

/** Describir con palabras o con una foto lo que has comido; la IA lo pasa a alimentos y gramos. */
function DescribeMeal({
  day,
  mealId,
  foods,
  busy,
  onApply,
}: {
  day: string;
  mealId: string;
  foods: Map<string, Food>;
  busy: boolean;
  onApply: (items: ResolvedMealLog["items"]) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ResolvedMealLog | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (image?: ImageInput) =>
    start(async () => {
      setMessage(null);
      setResult(null);
      const res = await parseMealLog(day, mealId, text, image);
      if (res.ok) setResult(res.data);
      else setMessage(res.message);
    });

  return (
    <div className="bg-surface-2 rounded-inner mt-3 flex flex-col gap-3 p-3.5">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) run();
        }}
      >
        <label className="sr-only" htmlFor={`describe-${mealId}`}>
          Qué has comido
        </label>
        <input
          id={`describe-${mealId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          autoComplete="off"
          placeholder="Pollo con arroz y una manzana…"
          className={`${inputClass} min-w-0 flex-1 py-2 text-sm`}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={pending || !text.trim()} className={`${buttonClass.secondary} text-xs`}>
            {pending ? "Leyendo…" : "Calcular"}
          </button>
          <PhotoButton label="Foto" busy={pending} onImage={(img) => run(img)} onError={setMessage} />
        </div>
      </form>
      {message && (
        <p role="alert" className="text-attention text-sm">
          {message}
        </p>
      )}
      {result && (
        <div className="flex flex-col gap-2 text-sm" aria-live="polite">
          {result.items.length > 0 && (
            <ul className="flex flex-col gap-0.5 tabular-nums">
              {result.items.map((it, i) => (
                <li key={i}>
                  {grams(it.grams)} {foods.get(it.food_id)?.name ?? "?"}
                </li>
              ))}
            </ul>
          )}
          {result.unknown.length > 0 && (
            <p className="text-attention text-xs">
              No está en tus alimentos: {result.unknown.join(", ")}. Añádelo en Alimentos si quieres contarlo.
            </p>
          )}
          {result.notes && <p className="text-muted text-xs">IA: {result.notes}</p>}
          <div className="flex gap-2">
            {result.items.length > 0 && (
              <button
                type="button"
                disabled={busy}
                className={`${buttonClass.primary} py-2 text-xs`}
                onClick={() => {
                  onApply(result.items);
                  setResult(null);
                  setText("");
                }}
              >
                Apuntar
              </button>
            )}
            <button type="button" onClick={() => setResult(null)} className={`${buttonClass.secondary} text-xs`}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const isComplete = (groups: PlanGroup[], logs: TrackerLog[], foods: Map<string, Food>) => {
  const relevant = groups.filter((g) => g.kind !== "veg" && g.options.length > 0);
  return relevant.length > 0 && relevant.every((g) => groupProgress(g, logs, foods).remaining < 0.05);
};

export function MealTracker({
  day,
  meal,
  foodList,
  initialLogs,
  initialStatus,
  yesterday,
}: {
  day: string;
  meal: { id: string; name: string; notes: string | null; groups: PlanGroup[] };
  foodList: Food[];
  initialLogs: TrackerLog[];
  initialStatus: Status | null;
  /** Lo que se apuntó en esta comida el día anterior (para «Igual que ayer»). */
  yesterday: { day: string; summary: string } | null;
}) {
  const foods = useMemo(() => new Map(foodList.map((f) => [f.id, f])), [foodList]);
  const [logs, setLogs] = useState(initialLogs);
  const [status, setStatus] = useState<Status | null>(initialStatus);
  // Si el servidor cambia los datos (copiar ayer, marcar el día…), se sincroniza el estado local
  const signature = `${initialStatus}|${initialLogs.map((l) => l.id).join(",")}`;
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setLogs(initialLogs);
    setStatus(initialStatus);
  }
  const [panel, setPanel] = useState<"none" | "describe" | "grams">("none");
  const [error, setError] = useState<string | null>(null);
  const [wishes, setWishes] = useState("");
  const [proposals, setProposals] = useState<ResolvedProposal[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();

  const eaten = totalsOf(logs, foods);
  const planned = sumTotals(meal.groups.map((g) => groupPortionTotals(g, foods)));
  const done = isComplete(meal.groups, logs, foods);

  const add = (items: { group_id: string | null; food_id: string; grams: number }[]) =>
    startTransition(async () => {
      setError(null);
      try {
        const saved = await addLogs(items.map((i) => ({ ...i, day, meal_id: meal.id })));
        const next = [...logs, ...saved];
        setLogs(next);
        // Comida completa sin estado: se marca como hecha sola
        if (status === null && isComplete(meal.groups, next, foods)) {
          setStatus("done");
          await setMealCheck(day, meal.id, "done");
        }
      } catch {
        setError("No se pudo apuntar. Inténtalo de nuevo.");
      }
    });

  const remove = (id: string) =>
    startTransition(async () => {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      await deleteLog(id);
    });

  const changeStatus = (value: Status) =>
    startTransition(async () => {
      const next = status === value ? null : value;
      setStatus(next);
      await setMealCheck(day, meal.id, next);
    });

  const copyYesterday = () =>
    startTransition(async () => {
      setError(null);
      try {
        await copyFromDay(yesterday!.day, day, meal.id);
      } catch {
        setError("No se pudo copiar.");
      }
    });

  const ask = () =>
    startAi(async () => {
      setError(null);
      setProposals(null);
      const res = await suggestMeal(day, meal.id, wishes);
      if (res.ok) setProposals(res.data);
      else setError(res.message);
    });

  const toggle = (p: typeof panel) => setPanel((v) => (v === p ? "none" : p));
  const empty = logs.length === 0 && status === null;

  return (
    <article className="rounded-tile border-border bg-surface border p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-3 font-semibold">
          <span
            aria-hidden="true"
            className={clsx("h-2.5 w-2.5 rounded-full", status || done ? "bg-nutrition" : "bg-border-strong")}
          />
          {meal.name}
        </h2>
        <p className="text-muted text-xs tabular-nums">
          {logs.length > 0 ? `${kcal(eaten.kcal)} de ~${kcal(planned.kcal)}` : `~${kcal(planned.kcal)}`}
        </p>
      </header>
      {meal.notes && <p className="text-muted mt-1 text-xs">{meal.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`Cómo fue: ${meal.name}`}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={status === s.value}
            disabled={pending}
            onClick={() => changeStatus(s.value)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-medium transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
              status === s.value
                ? `${s.className} border-transparent`
                : "border-border-strong text-muted hover:text-text",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {panel !== "grams" && status !== "skipped" && status !== "cheat" && (
        <QuickGroups groups={meal.groups} logs={logs} foods={foods} busy={pending} onAdd={add} onDelete={remove} />
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {yesterday && empty && (
          <button
            type="button"
            onClick={copyYesterday}
            disabled={pending}
            className={linkButton}
            title={yesterday.summary}
          >
            <Copy aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            Igual que ayer
          </button>
        )}
        <button
          type="button"
          onClick={() => toggle("describe")}
          aria-expanded={panel === "describe"}
          className={linkButton}
        >
          <MessageSquareText aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          Describir o foto
        </button>
        <button type="button" onClick={() => toggle("grams")} aria-expanded={panel === "grams"} className={linkButton}>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          {panel === "grams" ? "Cerrar gramos" : "Ajustar gramos"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-attention bg-surface-2 rounded-inner mt-3 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      {panel === "describe" && (
        <DescribeMeal
          day={day}
          mealId={meal.id}
          foods={foods}
          busy={pending}
          onApply={(items) => {
            add(items);
            setPanel("none");
          }}
        />
      )}

      {panel === "grams" && (
        <div className="mt-2">
          <ul className="divide-border divide-y">
            {meal.groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                logs={logs}
                foods={foods}
                foodList={foodList}
                onAdd={(groupId, foodId, gr) => add([{ group_id: groupId, food_id: foodId, grams: gr }])}
                onDelete={remove}
                busy={pending}
              />
            ))}
          </ul>

          {logs.length > 0 && (
            <p className="text-muted mt-2 text-xs tabular-nums">
              Apuntado: {kcal(eaten.kcal)} · P {grams(eaten.protein_g)} · HC {grams(eaten.carbs_g)} · G{" "}
              {grams(eaten.fat_g)}
              <button
                type="button"
                className="hover:text-text ml-3 underline underline-offset-2"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`¿Borrar todo lo apuntado en ${meal.name}?`)) return;
                  startTransition(async () => {
                    setLogs([]);
                    await clearMealLogs(day, meal.id);
                  });
                }}
              >
                Borrar todo
              </button>
            </p>
          )}

          {!done && (
            <div className="border-border mt-4 border-t pt-4">
              <p className="text-sm font-medium">¿No sabes qué comer?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`wishes-${meal.id}`}>
                  Preferencias
                </label>
                <input
                  id={`wishes-${meal.id}`}
                  value={wishes}
                  onChange={(e) => setWishes(e.target.value)}
                  maxLength={300}
                  autoComplete="off"
                  placeholder="Opcional: algo rápido, con pasta…"
                  className={`${inputClass} min-w-0 flex-1 py-2 text-xs`}
                />
                <button type="button" onClick={ask} disabled={aiPending} className={`${buttonClass.secondary} text-xs`}>
                  {aiPending ? "Pensando…" : "Generar con IA"}
                </button>
              </div>
            </div>
          )}

          {proposals && (
            <ul className="mt-3 grid gap-2.5 md:grid-cols-3" aria-live="polite">
              {proposals.map((p, i) => (
                <li key={i} className="bg-surface-2 rounded-inner flex flex-col p-4 text-sm">
                  <p className="font-semibold">{p.title}</p>
                  {p.description && <p className="text-muted mt-1 text-xs">{p.description}</p>}
                  <ul className="mt-2 flex flex-1 flex-col gap-0.5 text-xs tabular-nums">
                    {p.items.map((it) => {
                      const food = foods.get(it.food_id);
                      const cooked = foodList.find((f) => f.cooked_from === it.food_id && f.cooked_factor);
                      return (
                        <li key={`${it.option_id}-${it.group_id}`}>
                          {grams(it.grams)} {food?.name ?? "?"}
                          {cooked && (
                            <span className="text-muted"> (≈ {grams(it.grams * cooked.cooked_factor!)} cocido)</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    disabled={pending}
                    className={`${buttonClass.secondary} mt-3 text-xs`}
                    onClick={() => {
                      add(p.items.map(({ group_id, food_id, grams: g }) => ({ group_id, food_id, grams: g })));
                      setProposals(null);
                    }}
                  >
                    Apuntar esta
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

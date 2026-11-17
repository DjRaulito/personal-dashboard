"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import {
  groupProgress,
  KEY_MACRO,
  MACRO_LABELS,
  groupTarget,
  portionOf,
  type Food,
  type LogEntry,
  type PlanGroup,
} from "@/lib/nutrition/portions";

// Campos compactos en línea: sin el ancho completo de los formularios normales
const compact = inputClass.replace("w-full ", "");
const pct = (v: number) => `${Math.round(v * 100)} %`;
const num = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pill = (active: boolean) =>
  clsx(
    "rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
    active ? "bg-nutrition text-ink" : "bg-surface-2 text-muted hover:text-text",
  );

interface Meal {
  id: string;
  name: string;
  groups: PlanGroup[];
}

function Bar({ value, label }: { value: number; label: string }) {
  const over = value > 1.1;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(value, 1) * 100)}
      className="bg-surface-2 h-2.5 overflow-hidden rounded-full"
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

function GroupCalculator({
  group,
  entries,
  foods,
  foodList,
  onAdd,
  onRemove,
  onClear,
}: {
  group: PlanGroup;
  entries: LogEntry[];
  foods: Map<string, Food>;
  foodList: Food[];
  onAdd: (foodId: string, grams: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [foodId, setFoodId] = useState(group.options[0]?.food_id ?? "");
  const [amount, setAmount] = useState("");
  const [inUnits, setInUnits] = useState(() => Boolean(foods.get(group.options[0]?.food_id ?? "")?.unit_grams));
  const selected = foods.get(foodId);
  const hasUnit = Boolean(selected?.unit_label && selected.unit_grams);
  const typed = Number(amount.replace(",", "."));
  const typedGrams = inUnits && hasUnit ? typed * selected!.unit_grams! : typed;
  const preview = typedGrams > 0 && foodId ? portionOf(foodId, typedGrams, group, foods) : 0;
  const progress = groupProgress(group, entries, foods);
  const macro = KEY_MACRO[group.kind];
  const target = groupTarget(group, foods);

  // Alimentos del plan (y sus versiones cocidas) primero; luego el resto
  const planIds = new Set(group.options.map((o) => o.food_id));
  for (const f of foodList) if (f.cooked_from && planIds.has(f.cooked_from)) planIds.add(f.id);
  const planFoods = foodList.filter((f) => planIds.has(f.id));
  const otherFoods = foodList.filter((f) => !planIds.has(f.id));

  const submit = () => {
    if (!(typedGrams > 0) || !foodId) return;
    onAdd(foodId, Math.round(typedGrams * 10) / 10);
    setAmount("");
  };
  const describe = (e: LogEntry) => {
    const food = foods.get(e.food_id);
    const units = food?.unit_label && food.unit_grams ? e.grams / food.unit_grams : null;
    const qty =
      units !== null && Math.abs(units * 2 - Math.round(units * 2)) < 0.01
        ? `${num(units)} ${food!.unit_label}`
        : `${num(e.grams)} g`;
    return `${qty} · ${food?.name ?? "?"}`;
  };

  return (
    <section className="rounded-tile border-border bg-surface flex flex-col gap-4 border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-3 font-semibold">
          <span aria-hidden="true" className="bg-nutrition h-2.5 w-2.5 rounded-full" />
          {group.name}
        </h2>
        {macro && target > 0 && (
          <span className="text-muted text-xs tabular-nums">
            1 ración ≈ {num(target)} {macro === "kcal" ? "kcal" : `g de ${MACRO_LABELS[macro]}`}
          </span>
        )}
        <span
          className={clsx(
            "ml-auto text-sm font-semibold tabular-nums",
            progress.eaten > 1.1 ? "text-attention" : progress.eaten >= 0.95 ? "text-nutrition" : "text-text",
          )}
        >
          {pct(progress.eaten)}
        </span>
      </div>
      <Bar value={progress.eaten} label={`${group.name}: ración cubierta`} />

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={`food-${group.id}`}>
          Alimento
        </label>
        <select
          id={`food-${group.id}`}
          value={foodId}
          onChange={(e) => {
            setFoodId(e.target.value);
            setInUnits(Boolean(foods.get(e.target.value)?.unit_grams));
          }}
          className={`${compact} max-w-full min-w-0 flex-1 basis-44`}
        >
          <optgroup label="Del plan">
            {planFoods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Otros (se compara por su macro)">
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
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={inUnits && hasUnit ? "uds." : "g"}
          className={`${compact} w-20 tabular-nums`}
        />
        {hasUnit && (
          <button
            type="button"
            aria-pressed={inUnits}
            className={pill(inUnits)}
            onClick={() => setInUnits((v) => !v)}
            title={`1 ${selected!.unit_label} = ${num(selected!.unit_grams!)} g`}
          >
            {inUnits ? selected!.unit_label : "g"}
          </button>
        )}
        <button type="submit" disabled={!(typedGrams > 0)} className={buttonClass.secondary}>
          Añadir
        </button>
        {preview > 0 && <span className="text-muted text-xs tabular-nums">= {pct(preview)} de la ración</span>}
      </form>

      {entries.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {entries.map((e) => (
            <li key={e.id} className="bg-surface-2 flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-sm">
              <span className="tabular-nums">{describe(e)}</span>
              <span className="text-muted text-xs tabular-nums">
                {pct(portionOf(e.food_id, e.grams, group, foods))}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${describe(e)}`}
                className="text-muted hover:text-text rounded-full p-1"
                onClick={() => onRemove(e.id)}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="text-muted hover:text-text px-2 py-1 text-sm" onClick={onClear}>
              Vaciar
            </button>
          </li>
        </ul>
      )}

      <div>
        <p className="text-muted text-sm">
          {progress.remaining <= 0.02
            ? progress.eaten > 1.1
              ? `Te has pasado un ${pct(progress.eaten - 1)}.`
              : "Ración completa."
            : entries.length
              ? `Te falta el ${pct(progress.remaining)}. Complétalo con una de estas:`
              : "Una ración entera es una de estas:"}
        </p>
        {progress.remaining > 0.02 && (
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {progress.options.map((o) => (
              <li key={o.option.id} className="border-border flex items-baseline gap-2 border-b py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{o.food?.name ?? "?"}</span>
                <span className="text-right font-medium tabular-nums">
                  {o.units !== null ? `${num(o.units)} ${o.food?.unit_label ?? "ud."}` : `${num(o.grams)} g`}
                  {o.units === null && o.food?.unit_label && o.food.unit_grams ? (
                    <span className="text-muted font-normal">
                      {" "}
                      · {num(Math.round((o.grams / o.food.unit_grams) * 2) / 2)} {o.food.unit_label}
                    </span>
                  ) : null}
                  {o.cooked.map((c) => (
                    <span key={c.food.id} className="text-muted block text-xs font-normal">
                      {num(c.grams)} g en cocido
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Calculadora de porciones: lo que llevas de un grupo y cuánto falta de cada alimento. No guarda nada. */
export function PortionCalculator({ meals, foodList }: { meals: Meal[]; foodList: Food[] }) {
  const usable = meals.filter((m) => m.groups.some((g) => g.kind !== "veg" && g.options.length > 0));
  const [mealId, setMealId] = useState(usable[0]?.id ?? "");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const foods = useMemo(() => new Map(foodList.map((f) => [f.id, f])), [foodList]);
  const meal = usable.find((m) => m.id === mealId);
  const groups = meal?.groups.filter((g) => g.kind !== "veg" && g.options.length > 0) ?? [];
  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  if (!meal || !group) return <p className="text-muted text-sm">Tu plan aún no tiene comidas con raciones.</p>;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Comida"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {usable.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === meal.id}
              className={pill(m.id === meal.id)}
              onClick={() => {
                setMealId(m.id);
                setGroupId(null);
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Grupo"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {groups.map((g) => {
            const count = entries.filter((e) => e.group_id === g.id).length;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={g.id === group.id}
                className={pill(g.id === group.id)}
                onClick={() => setGroupId(g.id)}
              >
                {g.name}
                {count > 0 && <span className="ml-1.5 text-xs opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <GroupCalculator
        key={group.id}
        group={group}
        entries={entries.filter((e) => e.group_id === group.id)}
        foods={foods}
        foodList={foodList}
        onAdd={(food_id, grams) =>
          setEntries((list) => [...list, { id: crypto.randomUUID(), food_id, grams, group_id: group.id }])
        }
        onRemove={(id) => setEntries((list) => list.filter((e) => e.id !== id))}
        onClear={() => setEntries((list) => list.filter((e) => e.group_id !== group.id))}
      />
      <p className="text-muted text-sm">
        Los pesos del plan son en crudo. Si eliges arroz o pasta cocidos, se convierten solos; lo que no está en la
        lista de ese grupo se compara por su macro principal. Aquí no se guarda nada: es solo para hacer cuentas.
      </p>
    </>
  );
}

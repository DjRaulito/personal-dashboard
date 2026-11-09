"use client";

import { useState, useTransition } from "react";
import {
  addGroup,
  addMeal,
  deleteGroup,
  deleteMeal,
  deleteOption,
  renamePlan,
  saveOption,
  updateMeal,
} from "@/app/(app)/nutricion/actions";
import { CreatePlanForm } from "@/components/nutrition/setup";
import { buttonClass, inputClass } from "@/components/ui";
import {
  describeAmount,
  GROUP_KIND_LABELS,
  GROUP_KINDS,
  groupPortionTotals,
  sumTotals,
  type Food,
  type GroupKind,
  type PlanGroup,
  type PlanOption,
} from "@/lib/nutrition/portions";

// El plan se lee como el documento de la nutricionista; editar es un modo aparte para no
// llenar la pantalla de campos que casi nunca se tocan.

interface Meal {
  id: string;
  name: string;
  position: number;
  groups: PlanGroup[];
}

interface Ctx {
  editing: boolean;
  foods: Food[];
  foodMap: Map<string, Food>;
}

// Campos compactos en línea: sin el ancho completo de los formularios normales
const compact = inputClass.replace("w-full ", "");
const small = `${compact} py-1.5 text-xs`;
const kcal = (v: number) => `${Math.round(v).toLocaleString("es-ES")} kcal`;
const UNITS: { value: PlanOption["unit"]; label: string }[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "ud", label: "ud." },
];

function parseAmount(v: string): number {
  return Number(v.replace(",", "."));
}

function Macros({ t }: { t: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <span className="text-muted text-xs tabular-nums">
      {kcal(t.kcal)} · P {Math.round(t.protein_g)} · HC {Math.round(t.carbs_g)} · G {Math.round(t.fat_g)}
    </span>
  );
}

function FoodSelect({ foods, value, onChange }: { foods: Food[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      aria-label="Alimento"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${small} w-full min-w-0 sm:w-auto sm:flex-1`}
    >
      <option value="" disabled>
        Alimento…
      </option>
      {foods.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

/** Formulario de opción (nueva o existente): alimento + cantidad de una ración. */
function OptionForm({
  groupId,
  option,
  position,
  foods,
  onDone,
}: {
  groupId: string;
  option?: PlanOption;
  position?: number;
  foods: Food[];
  onDone?: () => void;
}) {
  const [foodId, setFoodId] = useState(option?.food_id ?? "");
  const [amount, setAmount] = useState(option ? String(option.amount).replace(".", ",") : "");
  const [unit, setUnit] = useState<PlanOption["unit"]>(option?.unit ?? "g");
  const [pending, startTransition] = useTransition();
  const valid = Boolean(foodId) && parseAmount(amount) > 0;

  return (
    <form
      autoComplete="off"
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        startTransition(async () => {
          await saveOption({
            id: option?.id,
            group_id: groupId,
            food_id: foodId,
            amount: parseAmount(amount),
            unit,
            position,
          });
          if (!option) {
            setFoodId("");
            setAmount("");
          }
          onDone?.();
        });
      }}
    >
      <FoodSelect foods={foods} value={foodId} onChange={setFoodId} />
      <input
        aria-label="Cantidad de una ración"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder="125…"
        className={`${small} w-20 tabular-nums`}
      />
      <select
        aria-label="Unidad"
        value={unit}
        onChange={(e) => setUnit(e.target.value as PlanOption["unit"])}
        className={`${small} w-auto`}
      >
        {UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending || !valid} className={`${buttonClass.secondary} py-1 text-xs`}>
        {option ? "Guardar" : "Añadir"}
      </button>
      {onDone && (
        <button type="button" onClick={onDone} className="text-muted hover:text-text text-xs">
          Cancelar
        </button>
      )}
    </form>
  );
}

function OptionChip({ option, groupId, ctx }: { option: PlanOption; groupId: string; ctx: Ctx }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const food = ctx.foodMap.get(option.food_id);
  const label = (
    <>
      {food?.name ?? "?"}{" "}
      <span className="text-muted tabular-nums">{describeAmount(option.amount, option.unit, food)}</span>
    </>
  );

  if (!ctx.editing) {
    return <li className="bg-surface-2 rounded-full px-3 py-1 text-sm">{label}</li>;
  }
  if (editing) {
    return (
      <li className="w-full">
        <OptionForm groupId={groupId} option={option} foods={ctx.foods} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="bg-surface-2 flex items-center rounded-full text-sm">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="hover:text-text focus-visible:outline-content rounded-full py-1 pr-1 pl-3 text-left focus-visible:outline-2"
        aria-label={`Editar ${food?.name ?? "opción"}`}
      >
        {label}
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label={`Quitar ${food?.name ?? "opción"}`}
        className="text-muted hover:text-expense focus-visible:outline-content rounded-full px-2 py-1 focus-visible:outline-2"
        onClick={() => startTransition(() => deleteOption(option.id))}
      >
        ×
      </button>
    </li>
  );
}

function GroupBlock({ group, ctx }: { group: PlanGroup; ctx: Ctx }) {
  const [pending, startTransition] = useTransition();
  const kindLabel = GROUP_KIND_LABELS[group.kind];
  const portion = groupPortionTotals(group, ctx.foodMap);
  const pick =
    group.kind === "veg"
      ? "a voluntad"
      : group.options.length > 1
        ? `elige 1 de ${group.options.length}`
        : `${Math.round(portion.kcal)} kcal`;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h4 className="text-sm font-medium">{group.name}</h4>
        {group.name !== kindLabel && <span className="text-muted text-xs">{kindLabel}</span>}
        <span className="text-muted text-xs">· {pick}</span>
        {ctx.editing && (
          <button
            type="button"
            disabled={pending}
            className="text-muted hover:text-expense ml-auto text-xs underline underline-offset-2"
            onClick={() => {
              if (confirm(`¿Borrar "${group.name}" con sus opciones?`)) startTransition(() => deleteGroup(group.id));
            }}
          >
            Borrar grupo
          </button>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {group.options.map((o) => (
          <OptionChip key={o.id} option={o} groupId={group.id} ctx={ctx} />
        ))}
      </ul>
      {ctx.editing && <AddOption group={group} foods={ctx.foods} />}
    </li>
  );
}

function AddOption({ group, foods }: { group: PlanGroup; foods: Food[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:text-text self-start text-xs underline underline-offset-2"
      >
        + Añadir opción
      </button>
    );
  }
  return <OptionForm groupId={group.id} position={group.options.length} foods={foods} onDone={() => setOpen(false)} />;
}

function AddGroup({ meal }: { meal: Meal }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Añadir grupo"
      value=""
      disabled={pending}
      onChange={(e) => {
        const k = e.target.value as GroupKind;
        if (k) startTransition(() => addGroup(meal.id, GROUP_KIND_LABELS[k], k, meal.groups.length));
      }}
      className={`${small} w-auto`}
    >
      <option value="">+ Añadir grupo…</option>
      {GROUP_KINDS.map((k) => (
        <option key={k} value={k}>
          {GROUP_KIND_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

function MealCard({
  meal,
  ctx,
  onMove,
}: {
  meal: Meal;
  ctx: Ctx;
  onMove: { up: boolean; down: boolean; go: (dir: -1 | 1) => void };
}) {
  const [name, setName] = useState(meal.name);
  const [pending, startTransition] = useTransition();
  const total = sumTotals(meal.groups.map((g) => groupPortionTotals(g, ctx.foodMap)));

  return (
    <section className="rounded-tile border-border bg-surface border p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {ctx.editing ? (
          <>
            <input
              aria-label="Nombre de la comida"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== meal.name) startTransition(() => updateMeal(meal.id, name, meal.position));
              }}
              maxLength={60}
              className={`${compact} w-44 py-1.5 font-semibold`}
            />
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Subir"
                disabled={!onMove.up || pending}
                onClick={() => onMove.go(-1)}
                className={`${buttonClass.secondary} px-2 py-1 text-xs`}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Bajar"
                disabled={!onMove.down || pending}
                onClick={() => onMove.go(1)}
                className={`${buttonClass.secondary} px-2 py-1 text-xs`}
              >
                ↓
              </button>
            </div>
          </>
        ) : (
          <h3 className="font-semibold">{meal.name}</h3>
        )}
        <span className="ml-auto">
          <Macros t={total} />
        </span>
      </div>

      {meal.groups.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4">
          {meal.groups.map((g) => (
            <GroupBlock key={g.id} group={g} ctx={ctx} />
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-3 text-sm">Sin grupos todavía.</p>
      )}

      {ctx.editing && (
        <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <AddGroup meal={meal} />
          <button
            type="button"
            disabled={pending}
            className="text-muted hover:text-expense text-xs underline underline-offset-2"
            onClick={() => {
              if (confirm(`¿Borrar "${meal.name}" con sus grupos?`)) startTransition(() => deleteMeal(meal.id));
            }}
          >
            Borrar comida
          </button>
        </div>
      )}
    </section>
  );
}

export function PlanEditor({
  plan,
  foods,
}: {
  plan: { id: string; name: string; notes: string | null; meals: Meal[] };
  foods: Food[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [mealName, setMealName] = useState("");
  const [pending, startTransition] = useTransition();
  const ctx: Ctx = { editing, foods, foodMap: new Map(foods.map((f) => [f.id, f])) };
  const dirty = name !== plan.name || notes !== (plan.notes ?? "");
  const total = sumTotals(plan.meals.flatMap((m) => m.groups.map((g) => groupPortionTotals(g, ctx.foodMap))));

  // Reordena intercambiando posiciones por índice (las posiciones guardadas pueden repetirse)
  const move = (index: number, dir: -1 | 1) => {
    const a = plan.meals[index];
    const b = plan.meals[index + dir];
    if (!a || !b) return;
    startTransition(async () => {
      await Promise.all([updateMeal(a.id, a.name, index + dir), updateMeal(b.id, b.name, index)]);
    });
  };

  const stats = [
    { label: "kcal", value: Math.round(total.kcal).toLocaleString("es-ES") },
    { label: "Proteína", value: `${Math.round(total.protein_g)} g` },
    { label: "Hidratos", value: `${Math.round(total.carbs_g)} g` },
    { label: "Grasas", value: `${Math.round(total.fat_g)} g` },
  ];

  return (
    <>
      <section className="rounded-tile border-border bg-surface flex flex-col gap-4 border p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          {editing ? (
            <input
              aria-label="Nombre del plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={`${inputClass} max-w-sm font-semibold`}
            />
          ) : (
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-balance">{plan.name}</h2>
              <p className="text-muted text-sm">Una ración de cada grupo por comida. Pesos en crudo.</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className={`${editing ? buttonClass.primary : buttonClass.secondary} ml-auto text-sm`}
          >
            {editing ? "Hecho" : "Editar plan"}
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-2 rounded-inner px-3 py-2">
              <dt className="text-muted text-xs">{s.label}</dt>
              <dd className="font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted -mt-2 text-xs">Aproximado con la ración media de cada grupo.</p>

        {editing ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Notas de la nutricionista</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              className={inputClass}
            />
          </label>
        ) : (
          plan.notes && (
            <details className="text-sm">
              <summary className="text-muted cursor-pointer select-none">Notas de la nutricionista</summary>
              <p className="mt-2 whitespace-pre-line">{plan.notes}</p>
            </details>
          )
        )}
        {editing && dirty && (
          <div>
            <button
              type="button"
              disabled={pending || !name.trim()}
              className={buttonClass.secondary}
              onClick={() => startTransition(() => renamePlan(plan.id, name, notes))}
            >
              Guardar nombre y notas
            </button>
          </div>
        )}
      </section>

      {plan.meals.map((m, i) => (
        <MealCard
          key={m.id}
          meal={m}
          ctx={ctx}
          onMove={{ up: !pending && i > 0, down: !pending && i < plan.meals.length - 1, go: (dir) => move(i, dir) }}
        />
      ))}

      {editing && (
        <>
          <form
            autoComplete="off"
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!mealName.trim()) return;
              startTransition(async () => {
                await addMeal(plan.id, mealName, plan.meals.length);
                setMealName("");
              });
            }}
          >
            <input
              aria-label="Nueva comida"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              maxLength={60}
              placeholder="Nueva comida: Recena…"
              className={`${inputClass} max-w-xs`}
            />
            <button type="submit" disabled={pending || !mealName.trim()} className={buttonClass.secondary}>
              Añadir comida
            </button>
          </form>
          <details className="text-sm">
            <summary className="text-muted cursor-pointer select-none">¿Plan nuevo de la nutricionista?</summary>
            <p className="text-muted mt-2">
              Crea uno nuevo: el actual se guarda como inactivo y lo apuntado en días anteriores se conserva.
            </p>
            <div className="mt-3">
              <CreatePlanForm />
            </div>
          </details>
        </>
      )}
    </>
  );
}

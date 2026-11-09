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
  updateGroup,
  updateMeal,
} from "@/app/(app)/nutricion/actions";
import { buttonClass, inputClass } from "@/components/ui";

// Campos compactos en línea: sin el ancho completo de los formularios normales
const compact = inputClass.replace("w-full ", "");
import {
  describeAmount,
  GROUP_KIND_LABELS,
  GROUP_KINDS,
  groupPortionTotals,
  sumTotals,
  type Food,
  type PlanGroup,
  type PlanOption,
} from "@/lib/nutrition/portions";

interface Meal {
  id: string;
  name: string;
  position: number;
  groups: PlanGroup[];
}

const small = `${compact} py-1.5 text-xs`;
const kcal = (v: number) => `${Math.round(v).toLocaleString("es-ES")} kcal`;

function FoodSelect({
  foods,
  value,
  onChange,
  label,
}: {
  foods: Food[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${small} w-auto min-w-0 flex-1`}
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

function GroupEditor({ group, foods, foodMap }: { group: PlanGroup; foods: Food[]; foodMap: Map<string, Food> }) {
  const [name, setName] = useState(group.name);
  const [kind, setKind] = useState<string>(group.kind);
  const [foodId, setFoodId] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<PlanOption["unit"]>("g");
  const [pending, startTransition] = useTransition();
  const dirty = name !== group.name || kind !== group.kind;
  const portion = groupPortionTotals(group, foodMap);

  return (
    <li className="bg-surface-2 rounded-inner p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Nombre del grupo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className={`${small} w-40 font-medium`}
        />
        <select
          aria-label="Tipo de grupo"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={`${small} w-auto`}
        >
          {GROUP_KINDS.map((k) => (
            <option key={k} value={k}>
              {GROUP_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {dirty && (
          <button
            type="button"
            disabled={pending || !name.trim()}
            className={`${buttonClass.secondary} py-1 text-xs`}
            onClick={() => startTransition(() => updateGroup(group.id, name, kind))}
          >
            Guardar
          </button>
        )}
        <span className="text-muted ml-auto text-xs tabular-nums">~{kcal(portion.kcal)} / ración</span>
        <button
          type="button"
          disabled={pending}
          aria-label={`Borrar el grupo ${group.name}`}
          className={`${buttonClass.danger} py-1 text-xs`}
          onClick={() => {
            if (confirm(`¿Borrar el grupo "${group.name}" y sus opciones?`))
              startTransition(() => deleteGroup(group.id));
          }}
        >
          Borrar
        </button>
      </div>
      <ul className="divide-border mt-2 divide-y">
        {group.options.map((o) => (
          <OptionRow key={o.id} option={o} groupId={group.id} foods={foods} foodMap={foodMap} />
        ))}
      </ul>
      <form
        autoComplete="off"
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount.replace(",", "."));
          if (!(n > 0) || !foodId) return;
          startTransition(async () => {
            await saveOption({ group_id: group.id, food_id: foodId, amount: n, unit, position: group.options.length });
            setFoodId("");
            setAmount("");
          });
        }}
      >
        <FoodSelect foods={foods} value={foodId} onChange={setFoodId} label="Nueva opción" />
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
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="ud">ud.</option>
        </select>
        <button
          type="submit"
          disabled={pending || !foodId || !amount}
          className={`${buttonClass.secondary} py-1 text-xs`}
        >
          Añadir opción
        </button>
      </form>
    </li>
  );
}

function OptionRow({
  option,
  groupId,
  foods,
  foodMap,
}: {
  option: PlanOption;
  groupId: string;
  foods: Food[];
  foodMap: Map<string, Food>;
}) {
  const [editing, setEditing] = useState(false);
  const [foodId, setFoodId] = useState(option.food_id);
  const [amount, setAmount] = useState(String(option.amount).replace(".", ","));
  const [unit, setUnit] = useState(option.unit);
  const [pending, startTransition] = useTransition();
  const food = foodMap.get(option.food_id);
  if (!editing) {
    return (
      <li className="flex items-center gap-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate">{food?.name ?? "?"}</span>
        <span className="text-muted tabular-nums">{describeAmount(option.amount, option.unit, food)}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted hover:text-text text-xs underline underline-offset-2"
        >
          Editar
        </button>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <FoodSelect foods={foods} value={foodId} onChange={setFoodId} label="Alimento" />
      <input
        aria-label="Cantidad"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className={`${small} w-20 tabular-nums`}
      />
      <select
        aria-label="Unidad"
        value={unit}
        onChange={(e) => setUnit(e.target.value as PlanOption["unit"])}
        className={`${small} w-auto`}
      >
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="ud">ud.</option>
      </select>
      <button
        type="button"
        disabled={pending}
        className={`${buttonClass.secondary} py-1 text-xs`}
        onClick={() =>
          startTransition(async () => {
            const n = Number(amount.replace(",", "."));
            if (!(n > 0) || !foodId) return;
            await saveOption({ id: option.id, group_id: groupId, food_id: foodId, amount: n, unit });
            setEditing(false);
          })
        }
      >
        Guardar
      </button>
      <button
        type="button"
        disabled={pending}
        className={`${buttonClass.danger} py-1 text-xs`}
        onClick={() => startTransition(() => deleteOption(option.id))}
      >
        Quitar
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-muted text-xs">
        Cancelar
      </button>
    </li>
  );
}

function MealEditor({ meal, foods, foodMap }: { meal: Meal; foods: Food[]; foodMap: Map<string, Food> }) {
  const [name, setName] = useState(meal.name);
  const [position, setPosition] = useState(String(meal.position));
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState<string>("protein");
  const [pending, startTransition] = useTransition();
  const dirty = name !== meal.name || position !== String(meal.position);
  const total = sumTotals(meal.groups.map((g) => groupPortionTotals(g, foodMap)));

  return (
    <section className="rounded-tile border-border bg-surface border p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Nombre de la comida"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className={`${compact} w-48 font-semibold`}
        />
        <label className="text-muted flex items-center gap-1.5 text-xs">
          Orden
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            inputMode="numeric"
            className={`${small} w-14 tabular-nums`}
          />
        </label>
        {dirty && (
          <button
            type="button"
            disabled={pending || !name.trim()}
            className={`${buttonClass.secondary} text-xs`}
            onClick={() => startTransition(() => updateMeal(meal.id, name, Number(position) || 0))}
          >
            Guardar
          </button>
        )}
        <span className="text-muted ml-auto text-xs tabular-nums">
          ~{kcal(total.kcal)} · P {Math.round(total.protein_g)} · HC {Math.round(total.carbs_g)} · G{" "}
          {Math.round(total.fat_g)}
        </span>
        <button
          type="button"
          disabled={pending}
          className={`${buttonClass.danger} text-xs`}
          onClick={() => {
            if (confirm(`¿Borrar "${meal.name}" con sus grupos?`)) startTransition(() => deleteMeal(meal.id));
          }}
        >
          Borrar
        </button>
      </div>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {meal.groups.map((g) => (
          <GroupEditor key={g.id} group={g} foods={foods} foodMap={foodMap} />
        ))}
      </ul>
      <form
        autoComplete="off"
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!groupName.trim()) return;
          startTransition(async () => {
            await addGroup(meal.id, groupName, groupKind, meal.groups.length);
            setGroupName("");
          });
        }}
      >
        <input
          aria-label="Nuevo grupo"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={60}
          placeholder="Nuevo grupo: Proteína…"
          className={`${small} w-48`}
        />
        <select
          aria-label="Tipo del nuevo grupo"
          value={groupKind}
          onChange={(e) => setGroupKind(e.target.value)}
          className={`${small} w-auto`}
        >
          {GROUP_KINDS.map((k) => (
            <option key={k} value={k}>
              {GROUP_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !groupName.trim()}
          className={`${buttonClass.secondary} py-1 text-xs`}
        >
          Añadir grupo
        </button>
      </form>
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
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [mealName, setMealName] = useState("");
  const [pending, startTransition] = useTransition();
  const dirty = name !== plan.name || notes !== (plan.notes ?? "");
  const total = sumTotals(plan.meals.flatMap((m) => m.groups.map((g) => groupPortionTotals(g, foodMap))));

  return (
    <>
      <section className="rounded-tile border-border bg-surface flex flex-col gap-3 border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Nombre del plan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className={`${inputClass} max-w-sm font-semibold`}
          />
          <p className="text-muted text-sm tabular-nums">
            Día completo: ~{kcal(total.kcal)} · P {Math.round(total.protein_g)} g · HC {Math.round(total.carbs_g)} g · G{" "}
            {Math.round(total.fat_g)} g
          </p>
        </div>
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
        {dirty && (
          <div>
            <button
              type="button"
              disabled={pending || !name.trim()}
              className={buttonClass.secondary}
              onClick={() => startTransition(() => renamePlan(plan.id, name, notes))}
            >
              Guardar plan
            </button>
          </div>
        )}
      </section>
      {plan.meals.map((m) => (
        <MealEditor key={m.id} meal={m} foods={foods} foodMap={foodMap} />
      ))}
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
    </>
  );
}

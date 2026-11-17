"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
import { chefMeal } from "@/app/(app)/nutricion/actions";
import { buttonClass, Field, inputClass, Tile, TileTitle } from "@/components/ui";
import type { ResolvedProposal } from "@/lib/nutrition/ai";
import { cookedVersions, totalsOf, type Food, type PlanGroup } from "@/lib/nutrition/portions";

interface Meal {
  id: string;
  name: string;
  groups: PlanGroup[];
}

const num = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pill = (active: boolean) =>
  clsx(
    "rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
    active ? "bg-nutrition text-ink" : "bg-surface-2 text-muted hover:text-text",
  );

const SPLITS = [
  { value: 1, label: "Un alimento por macro" },
  { value: 2, label: "Repartir en 2" },
  { value: 3, label: "Repartir en 3" },
];

function Proposal({
  proposal,
  groups,
  foods,
}: {
  proposal: ResolvedProposal;
  groups: PlanGroup[];
  foods: Map<string, Food>;
}) {
  const totals = totalsOf(proposal.items, foods);
  return (
    <Tile>
      <TileTitle dot="bg-nutrition">{proposal.title}</TileTitle>
      {proposal.description && <p className="text-muted mt-2 text-sm">{proposal.description}</p>}
      <dl className="mt-4 flex flex-col gap-3">
        {groups
          .filter((g) => proposal.items.some((i) => i.group_id === g.id))
          .map((g) => (
            <div key={g.id} className="border-border border-t pt-3">
              <dt className="text-muted text-xs">{g.name}</dt>
              <dd className="mt-1 flex flex-col gap-1 text-sm">
                {proposal.items
                  .filter((i) => i.group_id === g.id)
                  .map((i) => {
                    const food = foods.get(i.food_id);
                    const cooked = cookedVersions(i.food_id, foods)[0];
                    return (
                      <span key={i.option_id} className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1">{food?.name ?? "?"}</span>
                        <span className="text-right font-medium tabular-nums">
                          {num(i.grams)} g
                          {food?.unit_label && food.unit_grams ? (
                            <span className="text-muted font-normal">
                              {" "}
                              · {num(Math.round((i.grams / food.unit_grams) * 2) / 2)} {food.unit_label}
                            </span>
                          ) : null}
                          {cooked?.cooked_factor ? (
                            <span className="text-muted block text-xs font-normal">
                              {num(Math.round((i.grams * cooked.cooked_factor) / 5) * 5)} g en cocido
                            </span>
                          ) : null}
                        </span>
                      </span>
                    );
                  })}
              </dd>
            </div>
          ))}
      </dl>
      {proposal.steps.length > 0 && (
        <ol className="text-muted mt-4 list-decimal space-y-1 pl-5 text-sm">
          {proposal.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      <p className="border-border mt-4 border-t pt-3 text-xs tabular-nums">
        {Math.round(totals.kcal).toLocaleString("es-ES")} kcal · P {Math.round(totals.protein_g)} g · HC{" "}
        {Math.round(totals.carbs_g)} g · G {Math.round(totals.fat_g)} g
      </p>
    </Tile>
  );
}

/** Chef: platos para una comida del plan, con la opción de repartir cada macro entre varios alimentos. */
export function ChefPanel({ meals, foodList }: { meals: Meal[]; foodList: Food[] }) {
  const usable = meals.filter((m) => m.groups.some((g) => g.options.length > 1));
  const foods = useMemo(() => new Map(foodList.map((f) => [f.id, f])), [foodList]);
  const [mealId, setMealId] = useState(usable[0]?.id ?? "");
  const [maxPerGroup, setMaxPerGroup] = useState(1);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [pins, setPins] = useState<Record<string, string[]>>({});
  const [wishes, setWishes] = useState("");
  const [result, setResult] = useState<{ mealId: string; proposals: ResolvedProposal[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const meal = usable.find((m) => m.id === mealId);

  if (!meal) return <p className="text-muted text-sm">Tu plan aún no tiene comidas con varias opciones.</p>;
  const groups = meal.groups.filter((g) => g.options.length > 0);
  const active = groups.filter((g) => !off.has(g.id));

  const togglePin = (groupId: string, optionId: string) =>
    setPins((p) => {
      const list = p[groupId] ?? [];
      const next = list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId].slice(-4);
      return { ...p, [groupId]: next };
    });

  const ask = () =>
    start(async () => {
      setMessage(null);
      const res = await chefMeal({
        mealId: meal.id,
        groupIds: active.map((g) => g.id),
        maxPerGroup,
        pins: Object.fromEntries(
          active.map((g) => [g.id, pins[g.id] ?? []] as const).filter(([, list]) => list.length > 0),
        ),
        wishes,
      });
      if (!res.ok) return setMessage(res.message);
      setResult({ mealId: meal.id, proposals: res.data });
    });

  return (
    <>
      <Tile>
        <TileTitle dot="bg-nutrition">¿Qué cocinamos?</TileTitle>
        <div className="mt-4 flex flex-col gap-5">
          <div role="group" aria-label="Comida" className="flex flex-wrap gap-1.5">
            {usable.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === meal.id}
                className={pill(m.id === meal.id)}
                onClick={() => setMealId(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div>
            <p className="text-muted text-sm">Reparto de cada macro</p>
            <div role="group" aria-label="Reparto de cada macro" className="mt-2 flex flex-wrap gap-1.5">
              {SPLITS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={maxPerGroup === s.value}
                  className={pill(maxPerGroup === s.value)}
                  onClick={() => setMaxPerGroup(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-muted text-sm">
              Grupos de la comida. Abre uno para obligar a usar ciertos alimentos (por ejemplo, arroz y pan a medias).
            </p>
            {groups.map((g) => {
              const on = !off.has(g.id);
              const pinned = pins[g.id] ?? [];
              return (
                <details key={g.id} className="bg-surface-2 rounded-inner group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      aria-label={`Incluir ${g.name}`}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() =>
                        setOff((s) => {
                          const next = new Set(s);
                          if (on) next.add(g.id);
                          else next.delete(g.id);
                          return next;
                        })
                      }
                      className="accent-nutrition h-4 w-4"
                    />
                    <span className={clsx("font-medium", !on && "text-muted line-through")}>{g.name}</span>
                    <span className="text-muted ml-auto text-xs">
                      {pinned.length
                        ? pinned
                            .map((id) => foods.get(g.options.find((o) => o.id === id)?.food_id ?? "")?.name)
                            .join(" + ")
                        : "A elección del chef"}
                    </span>
                  </summary>
                  <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                    {g.options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={!on}
                        aria-pressed={pinned.includes(o.id)}
                        className={clsx(
                          pill(pinned.includes(o.id)),
                          !pinned.includes(o.id) && "bg-surface",
                          "disabled:opacity-50",
                        )}
                        onClick={() => togglePin(g.id, o.id)}
                      >
                        {foods.get(o.food_id)?.name ?? "?"}
                      </button>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <Field label="¿Algo en especial? (opcional)">
            <input
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              maxLength={300}
              placeholder="Rápido, para táper, sin horno, con lo que tengo: pollo y arroz…"
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || active.length === 0}
              className={buttonClass.primary}
              onClick={ask}
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              {pending ? "Pensando…" : result ? "Otras ideas" : "Proponer platos"}
            </button>
            {message && (
              <p role="alert" className="text-attention text-sm">
                {message}
              </p>
            )}
          </div>
        </div>
      </Tile>

      {result && (
        <div aria-live="polite" className="grid gap-3.5 lg:grid-cols-3">
          {result.proposals.map((p, i) => (
            <Proposal
              key={`${p.title}-${i}`}
              proposal={p}
              groups={usable.find((m) => m.id === result.mealId)?.groups ?? []}
              foods={foods}
            />
          ))}
        </div>
      )}
      <p className="text-muted text-sm">
        La IA elige los alimentos y la receta; los gramos los calcula la app con las raciones de tu plan (en crudo).
      </p>
    </>
  );
}

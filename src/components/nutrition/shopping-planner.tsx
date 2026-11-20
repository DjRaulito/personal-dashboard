"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Minus, Plus, Sparkles } from "lucide-react";
import { estimatePrices, setFoodPrice, setShoppingDays } from "@/app/(app)/nutricion/actions";
import { buttonClass, EmptyState, inputClass, Tile, TileTitle } from "@/components/ui";
import { describeAmount, type Food } from "@/lib/nutrition/portions";
import { formatWeight, groupDays, weeklyShopping, type ShoppingMeal } from "@/lib/nutrition/shopping";

const eur = (cents: number) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const num = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const WEEKS_PER_MONTH = 52 / 12;

function PriceInput({ food, onError }: { food: Food; onError: (message: string) => void }) {
  const [pending, start] = useTransition();
  const current = food.price_cents_per_kg ?? null;
  const save = (text: string) => {
    const clean = text.trim().replace(",", ".");
    const value = clean === "" ? null : Number(clean);
    if (value !== null && !(Number.isFinite(value) && value >= 0 && value <= 500)) return onError("Precio no válido.");
    if ((value === null ? null : Math.round(value * 100)) === current) return;
    start(async () => {
      try {
        await setFoodPrice(food.id, value);
      } catch {
        onError("No se pudo guardar el precio.");
      }
    });
  };
  return (
    <label className="flex items-center justify-end gap-1.5">
      <span className="sr-only">Precio de {food.name} en euros por kilo</span>
      <input
        key={current ?? "sin-precio"}
        inputMode="decimal"
        defaultValue={current === null ? "" : String(current / 100).replace(".", ",")}
        placeholder="—"
        disabled={pending}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={clsx(
          inputClass.replace("w-full", "").replace("px-3.5 py-2.5", "px-2 py-1.5"),
          "w-16 text-right tabular-nums",
          food.price_source === "ai" && "text-muted italic",
        )}
      />
      <span className="text-muted text-xs">€/kg</span>
    </label>
  );
}

/** Lista de la compra: eliges qué comes en una semana normal y calcula cantidad y gasto por alimento. */
export function ShoppingPlanner({
  meals,
  foodList,
  initialPicks,
}: {
  meals: ShoppingMeal[];
  foodList: Food[];
  initialPicks: Record<string, number>;
}) {
  const [picks, setPicks] = useState(() => new Map(Object.entries(initialPicks)));
  const [message, setMessage] = useState<string | null>(null);
  const [, startSave] = useTransition();
  const [aiPending, startAi] = useTransition();
  const foods = useMemo(() => new Map(foodList.map((f) => [f.id, f])), [foodList]);
  const summary = useMemo(() => weeklyShopping(meals, picks, foods), [meals, picks, foods]);

  const setDays = (optionId: string, days: number) => {
    const value = Math.max(0, Math.min(7, days));
    const previous = picks.get(optionId) ?? 0;
    if (value === previous) return;
    setMessage(null);
    setPicks((p) => {
      const next = new Map(p);
      if (value === 0) next.delete(optionId);
      else next.set(optionId, value);
      return next;
    });
    startSave(async () => {
      try {
        await setShoppingDays(optionId, value);
      } catch {
        setMessage("No se pudo guardar el último cambio.");
      }
    });
  };

  return (
    <>
      <section aria-label="Gasto aproximado" className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Tile>
          <p className="text-muted text-sm">A la semana</p>
          <p className="font-display mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">
            {summary.lines.length ? eur(summary.totalCents) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs">
            {summary.unpriced
              ? `Faltan ${summary.unpriced} ${summary.unpriced === 1 ? "precio" : "precios"}`
              : `${summary.lines.length} alimentos`}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Al mes</p>
          <p className="font-display mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">
            {summary.lines.length ? eur(Math.round(summary.totalCents * WEEKS_PER_MONTH)) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs">4,3 semanas</p>
        </Tile>
        <Tile className="col-span-2 lg:col-span-1">
          <p className="text-muted text-sm">Precios</p>
          <p className="mt-2 text-sm">Aproximados, en €/kg. Cámbialos por los de tu súper cuando quieras.</p>
          {summary.unpriced > 0 && (
            <button
              type="button"
              disabled={aiPending}
              className={`${buttonClass.secondary} mt-3`}
              onClick={() =>
                startAi(async () => {
                  setMessage(null);
                  const res = await estimatePrices(summary.lines.filter((l) => l.cents === null).map((l) => l.food.id));
                  if (!res.ok) setMessage(res.message);
                })
              }
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              {aiPending ? "Estimando…" : "Estimar los que faltan con IA"}
            </button>
          )}
        </Tile>
      </section>
      {message && (
        <p role="alert" className="text-attention text-sm">
          {message}
        </p>
      )}

      <Tile className="p-0 sm:p-0">
        <div className="px-4 pt-5 sm:px-6 sm:pt-6">
          <TileTitle dot="bg-nutrition">Lo que gastas en una semana</TileTitle>
        </div>
        {summary.lines.length === 0 ? (
          <div className="px-6">
            <EmptyState>Elige abajo qué sueles comer y aparecerá aquí.</EmptyState>
          </div>
        ) : (
          <ul className="mt-3">
            {summary.lines.map((line) => (
              <li
                key={line.food.id}
                className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_8.5rem_5rem] sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.food.name}</p>
                  <p className="text-muted truncate text-xs">
                    {line.uses.map((u) => `${u.meal} ×${u.days}`).join(" · ")}
                  </p>
                </div>
                <p className="text-right text-sm tabular-nums">
                  {formatWeight(line.grams)}
                  {line.units !== null && (
                    <span className="text-muted block text-xs">
                      {num(line.units)} {line.food.unit_label}
                    </span>
                  )}
                </p>
                <PriceInput food={line.food} onError={setMessage} />
                <p className="text-right text-sm font-semibold tabular-nums">
                  {line.cents === null ? <span className="text-muted font-normal">—</span> : eur(line.cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted border-border border-t px-4 py-3 text-xs sm:px-6">
          Cantidades en crudo, tal y como se compran. Los precios en cursiva son estimados por la IA.
        </p>
      </Tile>

      <Tile>
        <TileTitle dot="bg-nutrition">Qué comes en una semana normal</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Toca un alimento para elegirlo y ajusta cuántos días a la semana lo comes. Lo normal es que cada grupo sume 7
          días.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {meals.map((meal) => {
            const groups = meal.groups.filter((g) => g.options.length > 0);
            if (groups.length === 0) return null;
            const chosen = groups.reduce((s, g) => s + g.options.filter((o) => picks.has(o.id)).length, 0);
            return (
              <details key={meal.id} className="bg-surface-2 rounded-inner">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium">
                  {meal.name}
                  <span className="text-muted ml-auto text-xs font-normal">
                    {chosen ? `${chosen} ${chosen === 1 ? "elegido" : "elegidos"}` : "Sin elegir"}
                  </span>
                </summary>
                <div className="flex flex-col gap-4 px-4 pb-4">
                  {groups.map((group) => {
                    const total = groupDays(group, picks);
                    return (
                      <div key={group.id}>
                        <p className="flex items-baseline gap-2 text-xs">
                          <span className="text-muted">{group.name}</span>
                          {total > 0 && (
                            <span className={clsx("tabular-nums", total === 7 ? "text-nutrition" : "text-attention")}>
                              {total}/7 días
                            </span>
                          )}
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {group.options.map((option) => {
                            const food = foods.get(option.food_id);
                            const days = picks.get(option.id) ?? 0;
                            return (
                              <li key={option.id} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  aria-pressed={days > 0}
                                  className={clsx(
                                    "flex min-w-0 flex-1 items-baseline gap-2 rounded-full px-3.5 py-1.5 text-left text-sm transition-[background-color,color] duration-150",
                                    days > 0
                                      ? "bg-selected text-on-selected font-medium"
                                      : "bg-surface text-muted hover:text-text",
                                  )}
                                  onClick={() => setDays(option.id, days > 0 ? 0 : Math.max(1, 7 - total))}
                                >
                                  <span className="truncate">{food?.name ?? "?"}</span>
                                  <span className="ml-auto shrink-0 text-xs tabular-nums opacity-70">
                                    {describeAmount(option.amount, option.unit, food)}
                                  </span>
                                </button>
                                <div className={clsx("flex shrink-0 items-center gap-1", days === 0 && "invisible")}>
                                  <button
                                    type="button"
                                    aria-label={`Un día menos de ${food?.name ?? "alimento"}`}
                                    className="bg-surface text-muted hover:text-text rounded-full p-1.5"
                                    onClick={() => setDays(option.id, days - 1)}
                                  >
                                    <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-12 text-center text-xs tabular-nums">
                                    {days} {days === 1 ? "día" : "días"}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Un día más de ${food?.name ?? "alimento"}`}
                                    disabled={days >= 7}
                                    className="bg-surface text-muted hover:text-text rounded-full p-1.5 disabled:opacity-40"
                                    onClick={() => setDays(option.id, days + 1)}
                                  >
                                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </Tile>
    </>
  );
}

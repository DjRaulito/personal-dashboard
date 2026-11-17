"use client";

import { useOptimistic, useState, useTransition } from "react";
import { clsx } from "clsx";
import { CheckCheck } from "lucide-react";
import { markRestAsPlanned, setMealCheck } from "@/app/(app)/nutricion/actions";
import { buttonClass } from "@/components/ui";

export type MealStatus = "done" | "less" | "more" | "skipped" | "cheat";

const STATUS_OPTIONS: { value: MealStatus; label: string; className: string }[] = [
  { value: "done", label: "Hecha", className: "bg-nutrition text-ink" },
  { value: "less", label: "Comí menos", className: "bg-attention text-ink" },
  { value: "more", label: "Comí más", className: "bg-attention text-ink" },
  { value: "skipped", label: "Saltada", className: "bg-expense text-ink" },
  { value: "cheat", label: "Cheat", className: "bg-gym text-ink" },
];

/** Checklist del día: cómo ha ido cada comida del plan, sin apuntar gramos. */
export function DayChecklist({
  day,
  meals,
  initial,
}: {
  day: string;
  meals: { id: string; name: string }[];
  initial: Record<string, MealStatus>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checks, setOptimistic] = useOptimistic(initial, (state, change: Record<string, MealStatus | null>) =>
    Object.fromEntries(Object.entries({ ...state, ...change }).filter((e): e is [string, MealStatus] => e[1] !== null)),
  );
  const missing = meals.filter((m) => !checks[m.id]);

  const run = (change: Record<string, MealStatus | null>, fn: () => Promise<unknown>) =>
    start(async () => {
      setError(null);
      setOptimistic(change);
      try {
        await fn();
      } catch {
        setError("No se pudo guardar. Inténtalo de nuevo.");
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {meals.map((meal) => (
          <li key={meal.id} className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3">
            <span className="w-32 shrink-0 text-sm font-medium">{meal.name}</span>
            <div role="group" aria-label={`Estado de ${meal.name}`} className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const active = checks[meal.id] === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={active}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-[background-color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
                      active ? s.className : "bg-surface-2 text-muted hover:text-text",
                    )}
                    onClick={() =>
                      run({ [meal.id]: active ? null : s.value }, () =>
                        setMealCheck(day, meal.id, active ? null : s.value),
                      )
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {missing.length > 0 && (
          <button
            type="button"
            disabled={pending}
            className={buttonClass.secondary}
            onClick={() =>
              run(Object.fromEntries(missing.map((m) => [m.id, "done" as const])), () => markRestAsPlanned(day))
            }
          >
            <CheckCheck aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            {missing.length === meals.length ? "Todo según el plan" : "El resto, según el plan"}
          </button>
        )}
        {error && (
          <p role="alert" className="text-attention text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

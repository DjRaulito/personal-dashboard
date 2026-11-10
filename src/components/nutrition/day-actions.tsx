"use client";

import { useState, useTransition } from "react";
import { CheckCheck, Copy } from "lucide-react";
import { copyFromDay, markRestAsPlanned } from "@/app/(app)/nutricion/actions";
import { buttonClass } from "@/components/ui";

/** Atajos del día: marcar lo que falta como «según el plan» o copiar lo de ayer. */
export function DayActions({
  day,
  yesterday,
  pendingMeals,
  canCopy,
}: {
  day: string;
  yesterday: string;
  pendingMeals: number;
  canCopy: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (pendingMeals === 0 && !canCopy && !message) return null;

  const run = (fn: () => Promise<number>, done: (n: number) => string) =>
    start(async () => {
      setMessage(null);
      try {
        setMessage(done(await fn()));
      } catch {
        setMessage("No se pudo hacer. Inténtalo de nuevo.");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pendingMeals > 0 && (
        <button
          type="button"
          disabled={pending}
          className={buttonClass.secondary}
          onClick={() =>
            run(
              () => markRestAsPlanned(day),
              (n) =>
                n
                  ? `${n} ${n === 1 ? "comida marcada" : "comidas marcadas"} según el plan.`
                  : "Ya estaba todo marcado.",
            )
          }
        >
          <CheckCheck aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          {pendingMeals === 1 ? "La que falta, según el plan" : `Las ${pendingMeals} que faltan, según el plan`}
        </button>
      )}
      {canCopy && (
        <button
          type="button"
          disabled={pending}
          className={buttonClass.secondary}
          onClick={() =>
            run(
              () => copyFromDay(yesterday, day),
              (n) =>
                n ? `Copiadas ${n} ${n === 1 ? "comida" : "comidas"} de ayer.` : "Ayer no había nada que copiar.",
            )
          }
        >
          <Copy aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          Copiar ayer
        </button>
      )}
      {message && (
        <p role="status" className="text-muted text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

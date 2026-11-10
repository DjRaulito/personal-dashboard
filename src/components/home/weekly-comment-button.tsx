"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { generateWeeklyComment } from "@/app/(app)/ia/actions";

export function WeeklyCommentButton({ regenerate }: { regenerate: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await generateWeeklyComment();
            if (!res.ok) setError(res.message);
          })
        }
        className="text-muted hover:text-text inline-flex items-center gap-1.5 self-start rounded-full py-1 text-sm transition-colors duration-150 active:opacity-70 disabled:opacity-50"
      >
        <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        {pending ? "Pensando…" : regenerate ? "Volver a comentar" : "Comentar la semana con IA"}
      </button>
      {error && (
        <p role="alert" className="text-attention text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

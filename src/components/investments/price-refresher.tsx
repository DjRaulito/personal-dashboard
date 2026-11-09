"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Si los precios no son de hoy, pide al servidor que los actualice y recarga los datos. */
export function PriceRefresher({ stale }: { stale: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(stale ? "loading" : "idle");
  const [errors, setErrors] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    fetch("/api/investments/refresh", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res: { prices: number; errors: string[] }) => {
        setErrors(res.errors ?? []);
        setState("done");
        if (res.prices > 0) router.refresh();
      })
      .catch(() => setState("error"));
  }, [stale, router]);

  if (state === "idle") return null;
  return (
    <p role="status" className="text-muted text-xs">
      {state === "loading" && "Actualizando precios…"}
      {state === "done" && (errors.length ? `Precios actualizados (${errors.length} avisos)` : "Precios al día")}
      {state === "error" && "No se pudieron actualizar los precios"}
      {errors.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer">Ver avisos</summary>
          <ul className="mt-1 list-disc pl-4">
            {errors.slice(0, 10).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </p>
  );
}

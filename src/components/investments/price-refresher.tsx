"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "prices-refreshed-at";

/** Actualiza precios y tipos de cambio: sola si están desfasados (como mucho cada 6 h) o con el botón. */
export function PriceRefresher({ stale }: { stale: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const started = useRef(false);

  const run = useCallback(() => {
    setState("loading");
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // sin almacenamiento
    }
    fetch("/api/investments/refresh", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res: { prices: number; resolved: number; errors: string[] }) => {
        setErrors(res.errors ?? []);
        setState("done");
        if (res.prices > 0 || res.resolved > 0) router.refresh();
      })
      .catch(() => setState("error"));
  }, [router]);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    let recent = false;
    try {
      recent = Date.now() - Number(localStorage.getItem(KEY) ?? 0) < 6 * 3600 * 1000;
    } catch {
      // sin almacenamiento: actualizar igualmente
    }
    if (!recent) run();
  }, [stale, run]);

  return (
    <div role="status" className="text-muted flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={state === "loading"}
          className="hover:text-text underline-offset-2 hover:underline disabled:opacity-60"
        >
          {state === "loading" ? "Actualizando precios…" : "Actualizar precios"}
        </button>
        {state === "done" && <span>{errors.length ? `Hecho, con ${errors.length} avisos` : "Precios al día"}</span>}
        {state === "error" && <span>No se pudieron actualizar</span>}
      </div>
      {errors.length > 0 && (
        <details>
          <summary className="cursor-pointer">Ver avisos</summary>
          <ul className="mt-1 list-disc pl-4">
            {errors.slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

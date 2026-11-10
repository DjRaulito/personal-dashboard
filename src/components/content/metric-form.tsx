"use client";

import { useActionState, useTransition } from "react";
import { deleteMetric, saveMetric } from "@/app/(app)/contenido/actions";
import { buttonClass, Field, FormMessage, inputClass } from "@/components/ui";
import { PLATFORM_LABEL, PLATFORMS, type Platform } from "@/lib/content/catalog";
import { formatCompact } from "./format";

export interface MetricItem {
  id: string;
  platform: Platform;
  recorded_on: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers_gained: number;
}

const NUMBERS = [
  ["views", "Visualizaciones"],
  ["likes", "Me gusta"],
  ["comments", "Comentarios"],
  ["shares", "Compartidos"],
  ["saves", "Guardados"],
  ["followers_gained", "Seguidores ganados"],
] as const;

export function MetricForm({ pieceId, platforms, today }: { pieceId: string; platforms: Platform[]; today: string }) {
  const [state, action, pending] = useActionState(saveMetric, { ok: false });
  const options = platforms.length ? platforms : [...PLATFORMS];
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="piece_id" value={pieceId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plataforma" error={state.errors?.platform}>
          <select name="platform" defaultValue={options[0]} className={inputClass}>
            {options.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha" error={state.errors?.recorded_on}>
          <input name="recorded_on" type="date" defaultValue={today} max={today} required className={inputClass} />
        </Field>
        {NUMBERS.map(([name, label]) => (
          <Field key={name} label={label} error={state.errors?.[name]}>
            <input
              name={name}
              type="number"
              inputMode="numeric"
              min={name === "followers_gained" ? undefined : 0}
              defaultValue={0}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
      <p className="text-muted text-xs">
        Apunta las cifras totales que ves en la app ese día; si repites fecha y plataforma, se sustituyen.
      </p>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass.secondary}>
        {pending ? "Guardando…" : "Guardar métricas"}
      </button>
    </form>
  );
}

export function MetricList({ pieceId, metrics }: { pieceId: string; metrics: MetricItem[] }) {
  const [pending, start] = useTransition();
  if (!metrics.length) return null;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <caption className="sr-only">Métricas apuntadas</caption>
        <thead className="text-muted text-xs">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Fecha
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Plataforma
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Vistas
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Me gusta
            </th>
            <th scope="col" className="px-2 py-1.5">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {metrics.map((m) => (
            <tr key={m.id}>
              <td className="px-2 py-2 tabular-nums">{m.recorded_on.split("-").reverse().join("/")}</td>
              <td className="px-2 py-2">{PLATFORM_LABEL[m.platform]}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCompact(m.views)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCompact(m.likes)}</td>
              <td className="px-2 py-2 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => deleteMetric(m.id, pieceId))}
                  aria-label={`Borrar métricas de ${PLATFORM_LABEL[m.platform]} del ${m.recorded_on}`}
                  className="text-muted hover:text-expense focus-visible:outline-content rounded-full px-2 text-sm focus-visible:outline-2"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

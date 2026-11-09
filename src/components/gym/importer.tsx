"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteAllWorkouts, finishImport, importWorkoutBatch } from "@/app/(app)/gimnasio/actions";
import { buttonClass } from "@/components/ui";
import { APP_LOCALE } from "@/lib/datetime";
import { readSheetFile } from "@/lib/finance/read-sheet";
import { parseHevyCsv, type ParsedWorkout } from "@/lib/gym/hevy-csv";

const BATCH = 100;
const fmt = (iso: string) => new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium" }).format(new Date(iso));

type Status =
  | { kind: "idle" }
  | { kind: "importing"; done: number; total: number }
  | { kind: "done"; workouts: number; sets: number; newExercises: number }
  | { kind: "error"; message: string };

export function HevyImporter({ hasWorkouts }: { hasWorkouts: boolean }) {
  const [workouts, setWorkouts] = useState<ParsedWorkout[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    setWorkouts(null);
    setReadError(null);
    setStatus({ kind: "idle" });
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) return setReadError("El archivo pesa más de 30 MB.");
    try {
      const rows = (await readSheetFile(file)) as string[][];
      const parsed = parseHevyCsv(rows);
      if (parsed.length === 0) return setReadError("No se encontró ningún entreno en el archivo.");
      setWorkouts(parsed);
      setFileName(file.name);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  function runImport() {
    if (!workouts) return;
    startTransition(async () => {
      let sets = 0;
      let newExercises = 0;
      for (let i = 0; i < workouts.length; i += BATCH) {
        setStatus({ kind: "importing", done: i, total: workouts.length });
        const res = await importWorkoutBatch(workouts.slice(i, i + BATCH));
        if (!res.ok) {
          setStatus({ kind: "error", message: `${res.message} (entrenos ${i + 1}–${i + BATCH})` });
          return;
        }
        sets += res.sets;
        newExercises += res.newExercises;
      }
      await finishImport();
      setStatus({ kind: "done", workouts: workouts.length, sets, newExercises });
      setWorkouts(null);
    });
  }

  const totalSets = workouts?.reduce((s, w) => s + w.exercises.reduce((t, e) => t + e.sets.length, 0), 0) ?? 0;
  const exerciseNames = new Set(workouts?.flatMap((w) => w.exercises.map((e) => e.name)));

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-muted">Archivo CSV de Hevy</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={pending}
          className="file:bg-surface-2 file:text-text file:border-border-strong text-muted file:mr-3 file:rounded-full file:border file:px-4 file:py-2 file:text-sm file:font-medium"
        />
      </label>
      {readError && (
        <p role="alert" className="text-attention bg-surface-2 rounded-inner px-3.5 py-2.5 text-sm">
          {readError}
        </p>
      )}

      {workouts && (
        <div className="bg-surface-2 rounded-inner p-4 text-sm">
          <p className="font-semibold">{fileName}</p>
          <ul className="text-muted mt-2 flex flex-col gap-1 tabular-nums">
            <li>
              {workouts.length} entrenos · del {fmt(workouts[0].started_at)} al{" "}
              {fmt(workouts[workouts.length - 1].started_at)}
            </li>
            <li>
              {exerciseNames.size} ejercicios distintos · {totalSets} series
            </li>
            <li>Último: {workouts[workouts.length - 1].title}</li>
          </ul>
          <p className="text-muted mt-3">Los entrenos que ya estén importados se actualizan, no se duplican.</p>
          <button type="button" onClick={runImport} disabled={pending} className={`${buttonClass.primary} mt-4`}>
            {pending ? "Importando…" : `Importar ${workouts.length} entrenos`}
          </button>
        </div>
      )}

      <div aria-live="polite">
        {status.kind === "importing" && (
          <div>
            <p className="text-sm tabular-nums">
              Importando… {status.done} de {status.total}
            </p>
            <div className="bg-surface-2 mt-2 h-2 overflow-hidden rounded-full">
              <div
                className="bg-gym h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${Math.max(3, (status.done / status.total) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {status.kind === "done" && (
          <p className="text-finance bg-surface-2 rounded-inner px-3.5 py-2.5 text-sm" role="status">
            Listo: {status.workouts} entrenos y {status.sets} series
            {status.newExercises ? `, ${status.newExercises} ejercicios nuevos` : ""}.{" "}
            <Link href="/gimnasio" className="underline underline-offset-2">
              Ver resumen
            </Link>
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-attention bg-surface-2 rounded-inner px-3.5 py-2.5 text-sm" role="alert">
            {status.message}. Vuelve a intentarlo: lo ya importado no se duplica.
          </p>
        )}
      </div>

      {hasWorkouts && (
        <details className="border-border border-t pt-4 text-sm">
          <summary className="text-muted cursor-pointer select-none">Empezar de cero</summary>
          <p className="text-muted mt-2">
            Borra todos los entrenos importados (los ejercicios y medidas se conservan).
          </p>
          <button
            type="button"
            disabled={pending}
            className={`${buttonClass.danger} mt-2`}
            onClick={() => {
              if (confirm("¿Borrar todos los entrenos? No se puede deshacer.")) {
                startTransition(async () => {
                  await deleteAllWorkouts();
                  setStatus({ kind: "idle" });
                });
              }
            }}
          >
            Borrar todos los entrenos
          </button>
        </details>
      )}
    </div>
  );
}

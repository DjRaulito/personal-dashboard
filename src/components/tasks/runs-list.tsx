import { EmptyState, Tile, TileTitle } from "@/components/ui";
import type { TaskDetail } from "@/lib/tasks/server";

export const runWhen = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

/** Historial de ejecuciones de una tarea, la más reciente arriba. */
export function RunsList({ runs, noun = "nuevos" }: { runs: TaskDetail["runs"]; noun?: string }) {
  return (
    <Tile>
      <TileTitle dot="bg-content">Ejecuciones</TileTitle>
      {runs.length === 0 ? (
        <EmptyState>Aún no ha corrido.</EmptyState>
      ) : (
        <ul className="mt-3 flex flex-col">
          {runs.map((r) => (
            <li key={r.ranAt} className="border-border border-t py-2.5 text-sm first:border-t-0">
              <span className="font-semibold">{r.ok ? "✓ Fue bien" : "✕ Falló"}</span>
              <span className="text-muted">
                {" "}
                · {runWhen(r.ranAt)} · {r.found} {noun}, {r.removed} retirados
              </span>
              {r.summary && <p className="text-muted mt-0.5 text-pretty">{r.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/** Cabecera de la tarea: última ejecución y su resumen. */
export function RunSummary({ task }: { task: TaskDetail }) {
  const last = task.lastRun;
  return (
    <div>
      <h2 className="text-2xl font-bold">{task.name}</h2>
      <p className="text-muted mt-1 text-sm">
        {last ? `Última ejecución · ${runWhen(last.ranAt)}` : "Aún no ha corrido"}
        {task.schedule ? ` · corre ${task.schedule}` : ""}
        {last && !last.ok && <span className="text-attention font-semibold"> · ✕ Falló</span>}
      </p>
      {last?.summary && <p className="mt-2 max-w-3xl font-medium text-pretty">{last.summary}</p>}
    </div>
  );
}

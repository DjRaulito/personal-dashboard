import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { EmptyState, Tile } from "@/components/ui";
import { getTasks } from "@/lib/tasks/server";

export const metadata: Metadata = { title: "Tareas" };

const when = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

const STALE_MS = 3 * 86_400_000;

export default async function TasksPage() {
  const tasks = await getTasks();
  if (tasks.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Aún no hay tareas. Cuando una tarea programada (Cowork, Claude…) se registre con el conector del Cerebro, su
          sección aparecerá aquí sola.
        </EmptyState>
      </Tile>
    );
  }
  const now = Date.now();
  return (
    <ul className="grid gap-3.5 sm:grid-cols-2">
      {tasks.map((t) => {
        const stale = !t.archived && (!t.lastRun || now - Date.parse(t.lastRun.ranAt) > STALE_MS);
        return (
          <li key={t.id}>
            <Link
              href={`/tareas/${t.slug}`}
              className={clsx(
                "rounded-tile border-border bg-surface hover:border-border-strong flex h-full flex-col gap-2 border p-6 transition-colors",
                t.archived && "opacity-60",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold">{t.name}</span>
                {t.newItems > 0 && (
                  <span className="bg-attention text-ink ml-auto rounded-full px-2 text-sm font-bold tabular-nums">
                    {t.newItems} nuevos
                  </span>
                )}
              </span>
              {t.description && <span className="text-muted text-sm">{t.description}</span>}
              <span className="text-sm">
                {t.lastRun ? (
                  <>
                    {t.lastRun.ok ? "✓ Fue bien" : "✕ Falló"} · {when(t.lastRun.ranAt)}
                    {t.lastRun.found > 0 || t.lastRun.removed > 0
                      ? ` · ${t.lastRun.found} nuevos, ${t.lastRun.removed} retirados`
                      : ""}
                  </>
                ) : (
                  "Aún no ha corrido"
                )}
              </span>
              {t.schedule && <span className="text-muted text-xs">Corre {t.schedule}</span>}
              {stale && (
                <span className="text-attention text-xs font-semibold">! Sin ejecutar desde hace más de 3 días</span>
              )}
              {t.archived && <span className="text-muted text-xs">Archivada</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

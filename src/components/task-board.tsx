"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Archive, Check, ExternalLink, Star, X } from "lucide-react";
import { saveCriteria, setArchived, setItemStatus } from "@/app/(app)/tareas/actions";
import { buttonClass, EmptyState, FormMessage, inputClass, Tile, TileTitle } from "@/components/ui";
import { formatValue, ITEM_STATUSES, STATUS_LABELS, type ItemStatus } from "@/lib/tasks/fields";
import type { TaskDetail } from "@/lib/tasks/server";

const when = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

type View = ItemStatus | "runs" | "config";

/** Vista genérica de una tarea: se construye con los campos que declaró la propia tarea. */
export function TaskBoard({ task }: { task: TaskDetail }) {
  const [view, setView] = useState<View>("new");
  const [sortKey, setSortKey] = useState<string>("");
  const [desc, setDesc] = useState(true);
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [criteria, setCriteria] = useState(JSON.stringify(task.criteria, null, 2));
  const [saved, setSaved] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const urlField = task.fields.find((f) => f.type === "url");
  const titleField = task.fields.find((f) => f.type === "text");
  const counts = Object.fromEntries(
    ITEM_STATUSES.map((s) => [s, task.items.filter((i) => i.status === s).length]),
  ) as Record<ItemStatus, number>;

  const items = useMemo(() => {
    if (view === "runs" || view === "config") return [];
    const q = query.trim().toLowerCase();
    const list = task.items.filter(
      (i) => i.status === view && (!q || Object.values(i.data).some((v) => String(v).toLowerCase().includes(q))),
    );
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      const x = a.data[sortKey];
      const y = b.data[sortKey];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
      return desc ? -c : c;
    });
  }, [task.items, view, query, sortKey, desc]);

  const tabs: [View, string][] = [
    ...ITEM_STATUSES.map((s) => [s, `${STATUS_LABELS[s]} (${counts[s]})`] as [View, string]),
    ["runs", "Ejecuciones"],
    ["config", "Configuración"],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h2 className="text-2xl font-bold">{task.name}</h2>
        {task.description && <p className="text-muted mt-1 text-sm">{task.description}</p>}
        <p className="text-muted mt-1 text-xs">
          {task.schedule ? `Corre ${task.schedule}. ` : ""}
          {task.lastRun ? `Última ejecución: ${when(task.lastRun.ranAt)}.` : "Aún no ha corrido."}
        </p>
      </div>

      <div role="tablist" aria-label="Vista" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="bg-surface-2 flex w-max rounded-full p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap",
                view === id ? "bg-content text-ink" : "text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "runs" ? (
        <Tile>
          <TileTitle dot="bg-content">Ejecuciones</TileTitle>
          {task.runs.length === 0 ? (
            <EmptyState>Aún no ha corrido.</EmptyState>
          ) : (
            <ul className="mt-3 flex flex-col">
              {task.runs.map((r) => (
                <li key={r.ranAt} className="border-border border-t py-2.5 text-sm first:border-t-0">
                  <span className="font-semibold">{r.ok ? "✓ Fue bien" : "✕ Falló"}</span>
                  <span className="text-muted">
                    {" "}
                    · {when(r.ranAt)} · {r.found} nuevos, {r.removed} retirados
                  </span>
                  {r.summary && <p className="text-muted mt-0.5">{r.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </Tile>
      ) : view === "config" ? (
        <Tile>
          <TileTitle dot="bg-content">Criterios</TileTitle>
          <p className="text-muted mt-1 text-sm">
            La tarea los lee al empezar cada ejecución (en JSON). Campos de sus resultados:{" "}
            {task.fields.map((f) => f.label).join(", ") || "ninguno declarado"}.
          </p>
          <textarea
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            rows={10}
            spellCheck={false}
            aria-label="Criterios en JSON"
            className={clsx(inputClass, "mt-3 font-mono text-xs")}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => setSaved(await saveCriteria(task.slug, criteria)))}
              className={buttonClass.primary}
            >
              Guardar criterios
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => setArchived(task.slug, !task.archived))}
              className={buttonClass.secondary}
            >
              <Archive aria-hidden="true" className="h-4 w-4" /> {task.archived ? "Desarchivar" : "Archivar"}
            </button>
          </div>
          <div className="mt-3">
            <FormMessage state={saved} />
          </div>
        </Tile>
      ) : (
        <Tile>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar…"
              aria-label="Filtrar resultados"
              className={clsx(inputClass, "max-w-xs")}
            />
            {task.fields.length > 0 && (
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                aria-label="Ordenar por"
                className={clsx(inputClass, "w-auto")}
              >
                <option value="">Más recientes</option>
                {task.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    Ordenar por {f.label.toLowerCase()}
                  </option>
                ))}
              </select>
            )}
            {sortKey && (
              <button type="button" onClick={() => setDesc(!desc)} className={buttonClass.secondary}>
                {desc ? "Mayor primero" : "Menor primero"}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState>Nada en {STATUS_LABELS[view as ItemStatus].toLowerCase()}.</EmptyState>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const url = urlField ? String(item.data[urlField.key] ?? "") : "";
                const title = titleField ? String(item.data[titleField.key] ?? item.key) : item.key;
                return (
                  <li key={item.id} className="bg-surface-2 rounded-inner flex flex-col gap-2 p-4">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-semibold">{title}</p>
                      {item.removedAt && <span className="text-attention text-xs">! retirado</span>}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      {task.fields
                        .filter((f) => f !== titleField && f.type !== "url")
                        .map((f) => (
                          <div key={f.key} className="min-w-0">
                            <dt className="text-muted text-xs">{f.label}</dt>
                            <dd className="truncate tabular-nums">{formatValue(f.type, item.data[f.key])}</dd>
                          </div>
                        ))}
                    </dl>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-finance mr-auto inline-flex items-center gap-1 text-sm"
                        >
                          Abrir <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {(
                        [
                          ["favorite", "Favorito", Star],
                          ["seen", "Visto", Check],
                          ["discarded", "Descartar", X],
                        ] as const
                      )
                        .filter(([s]) => s !== item.status)
                        .map(([s, label, Icon]) => (
                          <button
                            key={s}
                            type="button"
                            disabled={pending}
                            onClick={() => start(() => setItemStatus(item.id, s))}
                            className="hover:bg-surface text-muted hover:text-text inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs"
                          >
                            <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label}
                          </button>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tile>
      )}
    </div>
  );
}

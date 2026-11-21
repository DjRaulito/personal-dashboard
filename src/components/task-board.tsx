"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Archive, X } from "lucide-react";
import { saveCriteria, setArchived, setItemStatus } from "@/app/(app)/tareas/actions";
import { ItemCards, ItemDays, ItemDetail, ItemTable } from "@/components/tasks/task-items";
import { buttonClass, EmptyState, FormMessage, inputClass, Tile, TileTitle } from "@/components/ui";
import { fieldRoles, groupByDay, groupCounts, groupField, groupLabel, type ItemStatus } from "@/lib/tasks/fields";
import type { TaskDetail, TaskItem } from "@/lib/tasks/server";

const when = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

const todayMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

type Filter = "new" | "favorite" | "all" | "discarded";
type View = Filter | "runs" | "config";

const FILTERS: [Filter, string][] = [
  ["new", "Nuevos"],
  ["favorite", "Favoritos"],
  ["all", "Todos"],
  ["discarded", "Descartados"],
];

const matches = (filter: Filter, i: TaskItem) => (filter === "all" ? i.status !== "discarded" : i.status === filter);

/**
 * Pantalla completa de una tarea: resumen de la última ejecución, resultados a todo el ancho
 * (tarjetas, tabla o por día según sus datos) y, al tocar uno, su detalle al lado.
 */
export function TaskBoard({ task }: { task: TaskDetail }) {
  const [pending, start] = useTransition();
  const [items, setOptimistic] = useOptimistic(
    task.items,
    (list: TaskItem[], change: { id: string; status: ItemStatus }) =>
      list.map((i) => (i.id === change.id ? { ...i, status: change.status } : i)),
  );
  const counts = {
    new: items.filter((i) => matches("new", i)).length,
    favorite: items.filter((i) => matches("favorite", i)).length,
    all: items.filter((i) => matches("all", i)).length,
    discarded: items.filter((i) => matches("discarded", i)).length,
  };
  // Si la tarea reparte sus resultados por estado (cartera / vigilancia…), se ven todos por grupos
  const groupBy = groupField(task.fields);
  const [view, setView] = useState<View>(counts.new > 0 && !groupBy ? "new" : "all");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("");
  const flags = fieldRoles(task.fields).flags;
  // Por defecto, solo los que cumplen los sí/no de la tarea (p. ej. «talla 42 confirmada»)
  const [onlyFlags, setOnlyFlags] = useState(flags.length > 0);
  const [criteria, setCriteria] = useState(JSON.stringify(task.criteria, null, 2));
  const [saved, setSaved] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const [now] = useState(() => Date.now());

  const onStatus = (id: string, status: ItemStatus) =>
    start(async () => {
      setOptimistic({ id, status });
      await setItemStatus(id, status);
    });

  const visible = useMemo(() => {
    if (view === "runs" || view === "config") return [];
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        matches(view, i) &&
        (!groupBy || !group || groupValue(i, groupBy.key) === group) &&
        (!onlyFlags || flags.every((f) => i.data[f.key] === true)) &&
        (!q || Object.values(i.data).some((v) => String(v).toLowerCase().includes(q))),
    );
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      const x = a.data[sortKey];
      const y = b.data[sortKey];
      return typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
    });
  }, [items, view, query, sortKey, onlyFlags, flags, group, groupBy]);

  const current = items.find((i) => i.id === selected) ?? null;

  // Escape cierra el detalle (en el móvil ocupa toda la pantalla)
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  const stale = !task.archived && (!task.lastRun || now - Date.parse(task.lastRun.ranAt) > 3 * 86_400_000);
  const listProps = { fields: task.fields, selected, onSelect: setSelected, onStatus, pending, now };
  const grouped =
    task.view === "days"
      ? groupByDay(
          visible,
          (i) => {
            const d = fieldRoles(task.fields).date;
            const v = d && i.data[d.key];
            return typeof v === "string" ? v : null;
          },
          todayMadrid(),
        )
      : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h2 className="text-2xl font-bold">{task.name}</h2>
        {task.description && task.lastRun && <p className="text-muted mt-1 text-sm">{task.description}</p>}
      </div>
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile className="col-span-2">
          <p className="text-muted text-sm">
            {task.lastRun ? `Última ejecución · ${when(task.lastRun.ranAt)}` : "Aún no ha corrido"}
            {task.schedule ? ` · corre ${task.schedule}` : ""}
          </p>
          <p className="mt-2 text-lg font-semibold text-pretty">
            {task.lastRun
              ? task.lastRun.summary || (task.lastRun.ok ? "Fue bien." : "Falló.")
              : task.description || "Cuando corra por primera vez, sus resultados aparecerán aquí."}
          </p>
          {task.lastRun && !task.lastRun.ok && <p className="text-attention mt-2 text-sm font-semibold">✕ Falló</p>}
          {stale && (
            <p className="text-attention mt-2 text-sm font-semibold">! Sin ejecutar desde hace más de 3 días</p>
          )}
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Nuevos</p>
          <p className="font-display mt-2 text-4xl font-extrabold tabular-nums">{counts.new}</p>
          {task.lastRun && (
            <p className="text-muted mt-1 text-sm">
              {task.lastRun.found} en la última, {task.lastRun.removed} retirados
            </p>
          )}
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Siguiendo</p>
          <p className="font-display mt-2 text-4xl font-extrabold tabular-nums">{counts.all}</p>
          <p className="text-muted mt-1 text-sm">
            {counts.favorite === 1 ? "1 favorito" : `${counts.favorite} favoritos`}
          </p>
        </Tile>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Resultados" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="bg-surface-2 flex w-max rounded-full p-1">
            {([...FILTERS, ["runs", "Ejecuciones"], ["config", "Configuración"]] as [View, string][]).map(
              ([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={clsx(
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap",
                    view === id ? "bg-selected text-on-selected" : "text-muted hover:text-text",
                  )}
                >
                  {label}
                  {id in counts && <span className="ml-1.5 tabular-nums opacity-70">{counts[id as Filter]}</span>}
                </button>
              ),
            )}
          </div>
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
        <div className={clsx("grid items-start gap-3.5", current && "lg:grid-cols-[minmax(0,1fr)_24rem]")}>
          <Tile className="@container">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en los resultados"
                className={clsx(inputClass, "sm:w-64")}
              />
              {task.fields.length > 0 && task.view !== "days" && (
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  aria-label="Ordenar por"
                  className={clsx(inputClass, "sm:w-56")}
                >
                  <option value="">Más recientes</option>
                  {task.fields
                    .filter((f) => f.type !== "url")
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        Por {f.label.toLowerCase()}
                      </option>
                    ))}
                </select>
              )}
              {flags.length > 0 && (
                <label className="text-muted inline-flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={onlyFlags} onChange={(e) => setOnlyFlags(e.target.checked)} />
                  Solo «{flags.map((f) => f.label).join("» y «")}»
                </label>
              )}
            </div>
            {groupBy && (
              <GroupChips
                groups={groupCounts(
                  items.filter((i) => matches(view, i)),
                  groupBy.key,
                )}
                value={group}
                onChange={setGroup}
              />
            )}
            {visible.length === 0 ? (
              <EmptyState>
                {items.length === 0
                  ? "Aún no ha guardado resultados."
                  : view === "new"
                    ? "No hay nada nuevo: ya lo has mirado todo."
                    : "Nada por aquí con estos filtros."}
              </EmptyState>
            ) : grouped ? (
              <ItemDays {...listProps} {...grouped} />
            ) : groupBy && !group ? (
              <div className="flex flex-col gap-6">
                {groupCounts(visible, groupBy.key).map(({ value, count }) => {
                  const list = visible.filter((i) => groupValue(i, groupBy.key) === value);
                  return (
                    <section key={value} aria-label={groupLabel(value)}>
                      <h3 className="mb-2 flex items-baseline gap-2 font-semibold">
                        {groupLabel(value)}
                        <span className="text-muted text-sm font-normal tabular-nums">{count}</span>
                      </h3>
                      {task.view === "table" ? (
                        <ItemTable {...listProps} items={list} />
                      ) : (
                        <ItemCards {...listProps} items={list} />
                      )}
                    </section>
                  );
                })}
              </div>
            ) : task.view === "table" ? (
              <ItemTable {...listProps} items={visible} />
            ) : (
              <ItemCards {...listProps} items={visible} />
            )}
          </Tile>
          {current && (
            <aside
              aria-label="Detalle"
              className="bg-bg fixed inset-0 z-50 overflow-y-auto p-5 lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0"
            >
              <Tile className="lg:sticky lg:top-24">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Cerrar detalle"
                  className="text-muted hover:text-text hover:bg-surface-2 float-right -mt-2 -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
                <ItemDetail fields={task.fields} item={current} pending={pending} onStatus={onStatus} />
              </Tile>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

const groupValue = (i: TaskItem, key: string) => {
  const v = i.data[key];
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : "sin estado";
};

/** Pastillas para ver un grupo (Cartera, Vigilancia…) o todos. */
function GroupChips({
  groups,
  value,
  onChange,
}: {
  groups: { value: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (groups.length < 2) return null;
  const chip = (id: string, label: string, count: number) => (
    <button
      key={id || "todos"}
      type="button"
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={clsx(
        "min-h-9 rounded-full border px-3.5 py-1 text-sm font-medium whitespace-nowrap transition-colors",
        value === id ? "bg-selected text-on-selected border-transparent" : "border-border text-muted hover:text-text",
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
  return (
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Grupos">
      {chip(
        "",
        "Todos",
        groups.reduce((s, g) => s + g.count, 0),
      )}
      {groups.map((g) => chip(g.value, groupLabel(g.value), g.count))}
    </div>
  );
}

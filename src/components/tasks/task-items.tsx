"use client";

import { clsx } from "clsx";
import { Check, ExternalLink, Star, X } from "lucide-react";
import { fieldRoles, formatValue, lastChange, valueSeries, type ItemStatus, type TaskField } from "@/lib/tasks/fields";
import type { TaskItem } from "@/lib/tasks/server";

// Cómo se pinta cada resultado de una tarea: tarjeta, fila de tabla o agrupado por día, y su detalle.

export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(new Date(iso));

const DAY_MS = 86_400_000;

/** «Nuevo» si no lo has mirado; «Cambio» si la tarea movió algún dato en el último día. */
export function ItemBadge({ item, now }: { item: TaskItem; now: number }) {
  if (item.removedAt) return <span className="text-attention text-xs font-semibold">Retirado</span>;
  if (item.status === "new")
    return <span className="bg-attention text-ink rounded-full px-2 py-0.5 text-xs font-bold">Nuevo</span>;
  if (item.changedAt && now - Date.parse(item.changedAt) < DAY_MS)
    return <span className="bg-content text-ink rounded-full px-2 py-0.5 text-xs font-bold">Cambio</span>;
  return null;
}

/** Bajada o subida de la cifra principal desde la vez anterior. */
export function PriceChange({ field, item }: { field: TaskField | undefined; item: TaskItem }) {
  if (!field) return null;
  const change = lastChange(field.key, item.data[field.key], item.history);
  if (!change) return null;
  const down = change.delta < 0;
  return (
    <span className={clsx("text-xs font-semibold tabular-nums", down ? "text-up" : "text-down")}>
      {down ? "▼" : "▲"} {formatValue(field.type, Math.abs(change.delta))} desde el {shortDate(change.since)}
    </span>
  );
}

const subtitle = (fields: TaskField[], item: TaskItem) =>
  fields
    .filter((f) => item.data[f.key] != null && item.data[f.key] !== "")
    .map((f) => formatValue(f.type, item.data[f.key]))
    .join(" · ");

/** €/m² cuando hay precio y superficie (pisos). */
const perSqm = (fields: TaskField[], item: TaskItem) => {
  const r = fieldRoles(fields);
  const p = r.price && item.data[r.price.key];
  const a = r.area && item.data[r.area.key];
  return typeof p === "number" && typeof a === "number" && a > 0 ? `${formatValue("money", p / a)}/m²` : null;
};

const STATUS_ACTIONS = [
  ["favorite", "Favorito", Star],
  ["seen", "Visto", Check],
  ["discarded", "Descartar", X],
] as const;

export function StatusButtons({
  item,
  pending,
  onStatus,
  big = false,
}: {
  item: TaskItem;
  pending: boolean;
  onStatus: (id: string, status: ItemStatus) => void;
  big?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-1", big && "flex-wrap")}>
      {STATUS_ACTIONS.map(([s, label, Icon]) => {
        const active = item.status === s;
        return (
          <button
            key={s}
            type="button"
            disabled={pending}
            aria-pressed={active}
            aria-label={big ? undefined : label}
            title={label}
            onClick={(e) => {
              e.stopPropagation();
              onStatus(item.id, active ? "seen" : s);
            }}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full transition-colors disabled:opacity-50",
              big ? "px-3.5 py-2 text-sm font-medium" : "h-11 w-11 justify-center",
              active ? "bg-selected text-on-selected" : "text-muted hover:bg-surface hover:text-text",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" fill={active && s === "favorite" ? "currentColor" : "none"} />
            {big && label}
          </button>
        );
      })}
    </div>
  );
}

interface ListProps {
  fields: TaskField[];
  items: TaskItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: ItemStatus) => void;
  pending: boolean;
  now: number;
  /** En la vista por día la fecha ya está en el título del grupo */
  skipDate?: boolean;
}

/** Tarjetas en mosaico: título, cifra grande con su bajada y el resto en una línea. */
export function ItemCards({ fields, items, selected, onSelect, onStatus, pending, now, skipDate }: ListProps) {
  const roles = fieldRoles(fields);
  const r = skipDate ? { ...roles, rest: roles.rest.filter((f) => f !== roles.date) } : roles;
  return (
    <ul className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard {...{ fields, item, onSelect, onStatus, pending, now }} active={selected === item.id} roles={r} />
        </li>
      ))}
    </ul>
  );
}

function ItemCard({
  fields,
  item,
  active,
  roles: r,
  onSelect,
  onStatus,
  pending,
  now,
}: {
  fields: TaskField[];
  item: TaskItem;
  active: boolean;
  roles: ReturnType<typeof fieldRoles>;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: ItemStatus) => void;
  pending: boolean;
  now: number;
}) {
  const title = r.title ? String(item.data[r.title.key] ?? item.key) : item.key;
  const sqm = perSqm(fields, item);
  return (
    <div
      className={clsx(
        "bg-surface-2 rounded-inner flex h-full flex-col gap-2 border p-4 transition-colors",
        active ? "border-border-strong" : "border-transparent",
        item.status === "discarded" && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-expanded={active}
        className="flex flex-col gap-1.5 text-left"
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{title}</span>
          <ItemBadge item={item} now={now} />
        </span>
        {r.price && (
          <span className="font-display text-2xl font-extrabold tabular-nums">
            {formatValue(r.price.type, item.data[r.price.key])}
          </span>
        )}
        <PriceChange field={r.price} item={item} />
        <span className="text-muted text-sm">{[subtitle(r.rest, item), sqm].filter(Boolean).join(" · ")}</span>
        {r.flags.some((f) => item.data[f.key] === true) && (
          <span className="flex flex-wrap gap-1">
            {r.flags
              .filter((f) => item.data[f.key] === true)
              .map((f) => (
                <span key={f.key} className="text-up text-xs font-semibold">
                  {f.label} ✓
                </span>
              ))}
          </span>
        )}
      </button>
      <div className="mt-auto flex items-center justify-between gap-1">
        {r.url && typeof item.data[r.url.key] === "string" && (
          <a
            href={String(item.data[r.url.key])}
            target="_blank"
            rel="noopener noreferrer"
            className="text-finance mr-auto inline-flex min-h-11 items-center gap-1 text-sm"
          >
            Abrir <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        )}
        <span className="ml-auto shrink-0">
          <StatusButtons item={item} pending={pending} onStatus={onStatus} />
        </span>
      </div>
    </div>
  );
}

/** Tabla para comparar cifras fila contra fila (p. ej. empresas del fondo). */
export function ItemTable({ fields, items, selected, onSelect, now }: ListProps) {
  const r = fieldRoles(fields);
  const cols = fields.filter((f) => f.type !== "url" && f !== r.title);
  const numeric = (f: TaskField) => ["number", "money", "area", "percent"].includes(f.type);
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="text-muted text-left text-xs">
            <th scope="col" className="py-2 pr-3 font-medium">
              {r.title?.label ?? "Resultado"}
            </th>
            {cols.map((f) => (
              <th key={f.key} scope="col" className={clsx("px-3 py-2 font-medium", numeric(f) && "text-right")}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={clsx(
                "border-border hover:bg-surface-2 cursor-pointer border-t",
                selected === item.id && "bg-surface-2",
                item.status === "discarded" && "opacity-60",
              )}
            >
              <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                <button type="button" onClick={() => onSelect(item.id)} className="text-left">
                  {r.title ? String(item.data[r.title.key] ?? item.key) : item.key}
                </button>{" "}
                <ItemBadge item={item} now={now} />
              </th>
              {cols.map((f) => (
                <td key={f.key} className={clsx("px-3 py-2.5", numeric(f) && "text-right tabular-nums")}>
                  {formatValue(f.type, item.data[f.key])}
                  {f === r.price && (
                    <span className="block">
                      <PriceChange field={f} item={item} />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** Agrupado por día, que es como se decide un plan. */
export function ItemDays({
  days,
  undated,
  past,
  ...props
}: Omit<ListProps, "items"> & { days: [string, TaskItem[]][]; undated: TaskItem[]; past: number }) {
  return (
    <div className="flex flex-col gap-5">
      {days.map(([day, list]) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h3 className="mb-2 text-sm font-semibold first-letter:uppercase">{dayLabel(day)}</h3>
          <ItemCards {...props} items={list} skipDate />
        </section>
      ))}
      {undated.length > 0 && (
        <section aria-label="Sin fecha">
          <h3 className="mb-2 text-sm font-semibold">Sin fecha</h3>
          <ItemCards {...props} items={undated} />
        </section>
      )}
      {past > 0 && (
        <p className="text-muted text-xs">
          {past === 1 ? "1 resultado de días pasados oculto." : `${past} resultados de días pasados ocultos.`}
        </p>
      )}
    </div>
  );
}

/** Detalle de un resultado: todos sus datos, la evolución de la cifra principal y las acciones. */
export function ItemDetail({
  fields,
  item,
  pending,
  onStatus,
}: {
  fields: TaskField[];
  item: TaskItem;
  pending: boolean;
  onStatus: (id: string, status: ItemStatus) => void;
}) {
  const r = fieldRoles(fields);
  const title = r.title ? String(item.data[r.title.key] ?? item.key) : item.key;
  const series = r.price ? valueSeries(r.price.key, item.data[r.price.key], item.history) : [];
  const url = r.url && typeof item.data[r.url.key] === "string" ? String(item.data[r.url.key]) : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-muted text-xs font-semibold tracking-wide uppercase">Detalle</p>
        <h3 className="mt-1 text-xl font-bold [overflow-wrap:anywhere]">{title}</h3>
        {r.price && (
          <p className="font-display mt-2 text-4xl font-extrabold tabular-nums">
            {formatValue(r.price.type, item.data[r.price.key])}
          </p>
        )}
        <PriceChange field={r.price} item={item} />
      </div>
      {r.price && series.length > 1 && (
        <p className="text-muted text-sm">
          {r.price.label} cada vez que la tarea lo vio:{" "}
          <span className="text-text tabular-nums">{series.map((v) => formatValue(r.price!.type, v)).join(" → ")}</span>
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {fields
          .filter((f) => f !== r.title && f !== r.price && f.type !== "url")
          .map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-muted text-xs">{f.label}</dt>
              <dd className="[overflow-wrap:anywhere] tabular-nums">{formatValue(f.type, item.data[f.key])}</dd>
            </div>
          ))}
        <div>
          <dt className="text-muted text-xs">Visto por primera vez</dt>
          <dd>{shortDate(item.firstSeenAt)}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Última vez</dt>
          <dd>{item.removedAt ? `Retirado el ${shortDate(item.removedAt)}` : shortDate(item.lastSeenAt)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-selected text-on-selected inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Abrir <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        )}
        <StatusButtons item={item} pending={pending} onStatus={onStatus} big />
      </div>
    </div>
  );
}

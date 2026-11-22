import Link from "next/link";
import { clsx } from "clsx";
import { ItemBadge } from "@/components/tasks/task-items";
import { EmptyState, Tile } from "@/components/ui";
import {
  formatPct,
  formatPrice,
  fundPosition,
  sinceBuy,
  sizeLabel,
  toEntry,
  upside,
  upsideFromEntry,
  type FundPosition,
} from "@/lib/tasks/fund";
import type { TaskItem } from "@/lib/tasks/server";

export const FUND_BASE = "/tareas/fondo-value";

export interface FundRow {
  item: TaskItem;
  p: FundPosition;
}

export const fundRows = (items: TaskItem[]): FundRow[] =>
  items.map((item) => ({ item, p: fundPosition(item.key, item.data) }));

/** Color según el signo: subida en celeste, bajada en rojo suave. */
export const signTone = (v: number | null) => (v == null ? "" : v >= 0 ? "text-up" : "text-down");

export function Stat({
  label,
  value,
  hint,
  tone,
  big = false,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: string;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className={clsx("font-semibold tabular-nums", big ? "font-display text-2xl font-extrabold" : "text-base", tone)}>
        {value}
      </dd>
      {hint && <dd className="text-muted text-xs">{hint}</dd>}
    </div>
  );
}

function Meta({ p }: { p: FundPosition }) {
  return (
    <span className="text-muted text-xs">
      {[p.ticker, sizeLabel(p.size), p.country].filter(Boolean).join(" · ")}
    </span>
  );
}

/** Tarjeta de una empresa en cartera: entrada, hoy, salida y lo que queda por subir. */
function PortfolioCard({ item, p, now }: FundRow & { now: number }) {
  const ret = sinceBuy(p);
  const up = upside(p);
  return (
    <Link
      href={`${FUND_BASE}/${item.id}`}
      className="bg-surface-2 rounded-inner hover:border-border-strong flex h-full flex-col gap-3 border border-transparent p-4 transition-colors"
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{p.name}</span>
          <Meta p={p} />
        </span>
        <ItemBadge item={item} now={now} />
      </span>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-4">
        <Stat label="Hoy" value={formatPrice(p.price, p.currency)} big />
        <Stat
          label="Entró a"
          value={formatPrice(p.buy, p.currency)}
          hint={<span className={signTone(ret)}>{formatPct(ret)} desde la compra</span>}
        />
        <Stat label="Precio de salida" value={formatPrice(p.target, p.currency)} />
        <Stat label="Revalorización" value={formatPct(up)} tone={signTone(up)} hint={`EV ${formatPct(p.ev)}`} />
      </dl>
      {p.note && <p className="text-muted line-clamp-2 text-sm">{p.note}</p>}
      {p.weight != null && <p className="text-muted mt-auto text-xs">Peso en cartera {formatPct(p.weight, false)}</p>}
    </Link>
  );
}

/** Tarjeta de una empresa en vigilancia: hoy, a qué precio entrar y hasta dónde puede subir. */
function WatchCard({ item, p, now }: FundRow & { now: number }) {
  const gap = toEntry(p);
  const up = upsideFromEntry(p);
  return (
    <Link
      href={`${FUND_BASE}/${item.id}`}
      className="bg-surface-2 rounded-inner hover:border-border-strong flex h-full flex-col gap-3 border border-transparent p-4 transition-colors"
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{p.name}</span>
          <Meta p={p} />
        </span>
        <ItemBadge item={item} now={now} />
      </span>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-4">
        <Stat label="Hoy" value={formatPrice(p.price, p.currency)} big />
        <Stat
          label="Entrar por debajo de"
          value={formatPrice(p.entryMax, p.currency)}
          hint={
            gap == null ? undefined : gap >= 0 ? (
              <span className="text-up font-semibold">✓ Ya está por debajo</span>
            ) : (
              `Le falta caer ${formatPct(-gap, false)}`
            )
          }
        />
        <Stat label="Precio de salida" value={formatPrice(p.target, p.currency)} />
        <Stat
          label="Revalorización"
          value={formatPct(up)}
          tone={signTone(up)}
          hint={`desde la entrada · hoy ${formatPct(upside(p))}`}
        />
      </dl>
      {p.note && <p className="text-muted line-clamp-2 text-sm">{p.note}</p>}
    </Link>
  );
}

export function FundList({ rows, kind, now }: { rows: FundRow[]; kind: "cartera" | "vigilancia"; now: number }) {
  if (rows.length === 0)
    return (
      <Tile>
        <EmptyState>
          {kind === "cartera"
            ? "No hay ninguna empresa en cartera ahora mismo."
            : "No hay ninguna empresa en vigilancia ahora mismo."}
        </EmptyState>
      </Tile>
    );
  const Card = kind === "cartera" ? PortfolioCard : WatchCard;
  return (
    <ul className="@container grid gap-3 lg:grid-cols-2">
      {rows.map((r) => (
        <li key={r.item.id} className="@container">
          <Card {...r} now={now} />
        </li>
      ))}
    </ul>
  );
}

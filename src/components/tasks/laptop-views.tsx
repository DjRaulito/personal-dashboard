import Link from "next/link";
import { clsx } from "clsx";
import { RemoteImage } from "@/components/tasks/remote-image";
import { ItemBadge } from "@/components/tasks/task-items";
import { EmptyState, Tile } from "@/components/ui";
import { formatValue } from "@/lib/tasks/fields";
import { discount, isOnSale, laptop, specs, type Laptop } from "@/lib/tasks/laptops";
import type { TaskItem } from "@/lib/tasks/server";

export const LAPTOP_BASE = "/tareas/ofertas-portatiles";

export interface LaptopRow {
  item: TaskItem;
  l: Laptop;
  onSale: boolean;
}

export function laptopRows(items: TaskItem[], now: number): LaptopRow[] {
  const rows = items.map((item) => {
    const l = laptop(item.key, item.data);
    return { item, l, onSale: isOnSale(l, item.history, item.changedAt, now) };
  });
  // Favoritos, luego en oferta, luego por precio; los retirados al final
  const rank = (r: LaptopRow) => (r.item.removedAt ? 3 : r.item.status === "favorite" ? 0 : r.onSale ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || (a.l.price ?? Infinity) - (b.l.price ?? Infinity));
}

export const euros = (v: number | null) => formatValue("money", v);

export function SaleTags({ row, now }: { row: LaptopRow; now: number }) {
  const off = discount(row.l);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <ItemBadge item={row.item} now={now} />
      {row.onSale && (
        <span className="bg-finance text-ink rounded-full px-2 py-0.5 text-xs font-bold">
          Oferta{off != null ? ` −${Math.round(off)} %` : ""}
        </span>
      )}
      {row.l.discovery && (
        <span className="border-border-strong rounded-full border px-2 py-0.5 text-xs font-semibold">
          Nuevo hallazgo
        </span>
      )}
      {row.item.status === "favorite" && <span className="text-xs font-semibold">★ Favorito</span>}
    </span>
  );
}

function LaptopCard({ row, now }: { row: LaptopRow; now: number }) {
  const { item, l } = row;
  return (
    <Link
      href={`${LAPTOP_BASE}/${item.id}`}
      className={clsx(
        "bg-surface-2 rounded-inner hover:border-border-strong flex h-full flex-col overflow-hidden border border-transparent transition-colors",
        item.removedAt && "opacity-60",
      )}
    >
      <RemoteImage src={l.image} alt={l.model} className="aspect-[4/3] w-full" />
      <span className="flex flex-1 flex-col gap-2 p-4">
        <SaleTags row={row} now={now} />
        <span className="font-semibold [overflow-wrap:anywhere]">{l.model}</span>
        <span className="flex flex-wrap gap-1.5">
          {specs(l).map((s) => (
            <span key={s} className="bg-surface text-muted rounded-full px-2 py-0.5 text-xs">
              {s}
            </span>
          ))}
        </span>
        <span className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="font-display text-2xl font-extrabold tabular-nums">{euros(l.price)}</span>
          {l.ref != null && l.price != null && l.ref > l.price && (
            <span className="text-muted text-sm tabular-nums line-through">{euros(l.ref)}</span>
          )}
        </span>
        <span className="text-muted text-xs">
          {item.removedAt ? "Ya no está a la venta" : (l.store ?? "Tienda sin indicar")}
        </span>
      </span>
    </Link>
  );
}

export function LaptopGrid({ rows, now, empty }: { rows: LaptopRow[]; now: number; empty: string }) {
  if (rows.length === 0)
    return (
      <Tile>
        <EmptyState>{empty}</EmptyState>
      </Tile>
    );
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <li key={r.item.id}>
          <LaptopCard row={r} now={now} />
        </li>
      ))}
    </ul>
  );
}

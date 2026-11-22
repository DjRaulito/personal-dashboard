import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ItemActions } from "@/components/tasks/item-actions";
import { euros, LAPTOP_BASE, SaleTags } from "@/components/tasks/laptop-views";
import { MarkSeen } from "@/components/tasks/mark-seen";
import { RemoteImage } from "@/components/tasks/remote-image";
import { PriceChange } from "@/components/tasks/task-items";
import { shortDate } from "@/lib/tasks/fields";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { discount, isOnSale, LAPTOP_SLUG, laptop } from "@/lib/tasks/laptops";
import { getTask } from "@/lib/tasks/server";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const task = await getTask(LAPTOP_SLUG);
  return task?.items.find((i) => i.id === id) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = await load((await params).id);
  return { title: item ? `${laptop(item.key, item.data).model} · Portátiles` : "Portátiles" };
}

export default async function LaptopPage({ params }: Params) {
  const item = await load((await params).id);
  if (!item) notFound();
  const l = laptop(item.key, item.data);
  const now = Date.now();
  const row = { item, l, onSale: isOnSale(l, item.history, item.changedAt, now) };
  const off = discount(l);
  // Precio cada vez que la tarea lo vio (lo más antiguo primero, sin repetir)
  const prices = [...item.history]
    .reverse()
    .map((h) => ({ at: h.at, price: h.data.precio, store: h.data.tienda }))
    .concat({ at: item.lastSeenAt, price: item.data.precio, store: item.data.tienda })
    .filter((p): p is { at: string; price: number; store: unknown } => typeof p.price === "number")
    .filter((p, i, all) => i === 0 || p.price !== all[i - 1].price);
  const rows = [
    ["Procesador", l.cpu],
    ["RAM", l.ram],
    ["Disco", l.disk],
    ["Pantalla", l.screen],
    ["Gráfica", l.gpu],
    ["Peso", l.weight],
    ["Tienda", l.store],
  ].filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <div className="flex flex-col gap-3.5">
      <MarkSeen id={item.id} status={item.status} />
      <BackLink href={row.onSale ? `${LAPTOP_BASE}/oferta` : LAPTOP_BASE}>
        {row.onSale ? "En oferta" : "Posibilidades"}
      </BackLink>
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Tile className="overflow-hidden p-0 sm:p-0">
          <RemoteImage src={l.image} alt={l.model} className="aspect-[4/3] w-full" />
        </Tile>
        <Tile>
          <SaleTags row={row} now={now} />
          <h3 className="mt-2 text-2xl font-bold [overflow-wrap:anywhere]">{l.model}</h3>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-4xl font-extrabold tabular-nums">{euros(l.price)}</span>
            {l.ref != null && (
              <span className="text-muted text-sm">
                Referencia <span className="tabular-nums">{euros(l.ref)}</span>
                {off != null && <span className="text-up font-semibold"> · −{Math.round(off)} %</span>}
              </span>
            )}
          </p>
          <PriceChange field={{ key: "precio", label: "Precio", type: "money" }} item={item} />
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted text-xs">{label}</dt>
                <dd className="[overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted text-xs">Visto por primera vez</dt>
              <dd>{shortDate(item.firstSeenAt)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Última comprobación</dt>
              <dd>{item.removedAt ? `Retirado el ${shortDate(item.removedAt)}` : shortDate(item.lastSeenAt)}</dd>
            </div>
          </dl>
          {l.note && <p className="mt-4 text-sm text-pretty">{l.note}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {l.link && (
              <a
                href={l.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-selected text-on-selected inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                Ver en la tienda <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            )}
            <ItemActions item={item} />
          </div>
        </Tile>
      </div>
      {prices.length > 1 && (
        <Tile>
          <TileTitle>Precio cada vez que la tarea lo miró</TileTitle>
          <ol className="mt-3 flex flex-col">
            {prices.map((p) => (
              <li
                key={p.at}
                className="border-border flex items-baseline justify-between gap-3 border-t py-2 text-sm first:border-t-0"
              >
                <span className="text-muted">
                  {shortDate(p.at)}
                  {typeof p.store === "string" && ` · ${p.store}`}
                </span>
                <span className="font-semibold tabular-nums">{euros(p.price)}</span>
              </li>
            ))}
          </ol>
        </Tile>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { date, dateTime, eur, num, pct, tone, VERDICT_TONE } from "@/components/properties/format";
import { buttonClass, EmptyState, inputClass, Tile, TileTitle } from "@/components/ui";
import { VERDICT_LABELS } from "@/lib/realestate/engine";
import { CONDITION_LABELS, STATUS_LABELS, STATUSES } from "@/lib/realestate/schemas";
import { getProperties } from "@/lib/realestate/server";
import {
  evaluateListings,
  filterListings,
  municipalities,
  parseFilters,
  summarize,
  type EvaluatedListing,
} from "@/lib/realestate/view";

export const metadata: Metadata = { title: "Inmuebles · Finanzas" };
export const dynamic = "force-dynamic";

const PAGE = "/finanzas/inmuebles";

type SearchParams = { estado?: string; municipio?: string; cumple?: string; vista?: string };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getProperties();
  const all = evaluateListings(data.listings, data.history, data.settings, new Date());
  const filters = parseFilters(sp);
  const list = filterListings(all, filters);
  const summary = summarize(all, data.runs);
  const table = sp.vista === "tabla";

  if (all.length === 0) {
    return (
      <Tile>
        <TileTitle>Inmuebles</TileTitle>
        <EmptyState>
          Aún no hay pisos. Conecta tu tarea diaria de Cowork y los anuncios aparecerán aquí con sus números.
        </EmptyState>
        <div className="flex justify-center">
          <Link href={`${PAGE}/ajustes`} className={buttonClass.primary}>
            Configurar y conectar
          </Link>
        </div>
      </Tile>
    );
  }

  const best = summary.best;
  const viewHref = (vista: "tarjetas" | "tabla") => {
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "vista" && v) as [string, string][]);
    if (vista === "tabla") q.set("vista", "tabla");
    const s = q.toString();
    return s ? `${PAGE}?${s}` : PAGE;
  };

  return (
    <>
      <section aria-label="Resumen" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {best ? (
          <Link
            href={`${PAGE}/${best.id}`}
            className="rounded-tile bg-finance text-ink focus-visible:outline-text p-6 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0 sm:col-span-2"
          >
            <p className="text-sm font-semibold">Mejor oportunidad</p>
            <p className="font-display mt-3 text-4xl leading-none font-extrabold">
              {best.ev.score.total}
              <span className="text-lg font-bold"> / 100</span>
            </p>
            <p className="mt-3 truncate font-semibold">{placeOf(best)}</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {eur(best.price)} · bruta {pct(best.ev.base?.grossYield)} · {eur(best.ev.base?.cashflowMonth, true)}/mes
            </p>
          </Link>
        ) : (
          <Tile className="sm:col-span-2">
            <p className="text-muted text-sm">Mejor oportunidad</p>
            <p className="text-muted mt-3">Ningún piso tiene todavía una renta estimada.</p>
          </Tile>
        )}
        <Tile>
          <p className="text-muted text-sm">Cumplen tus criterios</p>
          <p className="font-display mt-3 text-4xl font-extrabold tabular-nums">
            {summary.meeting}
            <span className="text-muted text-lg font-bold"> de {summary.active}</span>
          </p>
          <p className="text-muted mt-1 text-sm">
            {summary.newToday} nuevos hoy · {summary.priceDrops} con rebaja
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Última búsqueda</p>
          {summary.lastRun ? (
            <>
              <p className="font-display mt-3 text-2xl font-extrabold">{dateTime(summary.lastRun.ran_at)}</p>
              <p className="text-muted mt-1 text-sm tabular-nums">
                {summary.lastRun.examined} examinados · {summary.lastRun.saved} guardados
              </p>
            </>
          ) : (
            <p className="text-muted mt-3 text-sm">La tarea aún no ha enviado ningún resumen.</p>
          )}
        </Tile>
      </section>

      {summary.lastRun?.summary && (
        <p className="bg-surface rounded-inner border-border text-muted border px-4 py-3 text-sm">
          {summary.lastRun.summary}
        </p>
      )}

      {(summary.bestCashflow || summary.bestCashOnCash) && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {summary.bestCashflow && (
            <li>
              <Link
                href={`${PAGE}/${summary.bestCashflow.id}`}
                className="bg-surface-2 hover:bg-border rounded-full px-3 py-1"
              >
                Mejor cash flow: {placeOf(summary.bestCashflow)} (
                {eur(summary.bestCashflow.ev.base?.cashflowMonth, true)}
                /mes)
              </Link>
            </li>
          )}
          {summary.bestCashOnCash && (
            <li>
              <Link
                href={`${PAGE}/${summary.bestCashOnCash.id}`}
                className="bg-surface-2 hover:bg-border rounded-full px-3 py-1"
              >
                Mejor cash-on-cash: {placeOf(summary.bestCashOnCash)} ({pct(summary.bestCashOnCash.ev.base?.cashOnCash)}
                )
              </Link>
            </li>
          )}
        </ul>
      )}

      <Tile>
        <div className="flex flex-wrap items-end gap-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            {table && <input type="hidden" name="vista" value="tabla" />}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Estado</span>
              <select name="estado" defaultValue={filters.status} className={inputClass}>
                <option value="activos">En juego</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
                <option value="todos">Todos</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Municipio</span>
              <select name="municipio" defaultValue={filters.municipality} className={inputClass}>
                <option value="">Todos</option>
                {municipalities(all).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 py-2.5 text-sm">
              <input
                type="checkbox"
                name="cumple"
                value="1"
                defaultChecked={filters.onlyMeeting}
                className="accent-finance h-4 w-4"
              />
              Solo los que cumplen
            </label>
            <button type="submit" className={buttonClass.secondary}>
              Filtrar
            </button>
          </form>
          <div className="ml-auto flex flex-wrap gap-2">
            <nav aria-label="Vista" className="bg-surface-2 flex rounded-full p-1">
              {(["tarjetas", "tabla"] as const).map((v) => (
                <Link
                  key={v}
                  href={viewHref(v)}
                  aria-current={(v === "tabla") === table ? "page" : undefined}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors duration-150",
                    (v === "tabla") === table ? "bg-finance text-ink" : "text-muted hover:text-text",
                  )}
                >
                  {v}
                </Link>
              ))}
            </nav>
            <Link href={`${PAGE}/ajustes`} className={buttonClass.secondary}>
              Criterios y conexión
            </Link>
          </div>
        </div>
      </Tile>

      {list.length === 0 ? (
        <Tile>
          <EmptyState>Ningún piso con estos filtros.</EmptyState>
        </Tile>
      ) : table ? (
        <ListingTable list={list} />
      ) : (
        <ul className="grid gap-3.5 lg:grid-cols-2">
          {list.map((l, i) => (
            <li key={l.id}>
              <ListingCard l={l} rank={i + 1} grossMin={data.settings.criteria.gross_min_pct} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const placeOf = (l: EvaluatedListing) => [l.neighborhood, l.municipality].filter(Boolean).join(", ");

function Badges({ l }: { l: EvaluatedListing }) {
  const v = VERDICT_TONE[l.ev.verdict];
  return (
    <div className="flex flex-wrap gap-1.5 text-xs font-medium">
      <span className={clsx("bg-surface-2 rounded-full px-2.5 py-0.5", v.text)}>{VERDICT_LABELS[l.ev.verdict]}</span>
      {l.isNew && <span className="bg-content text-ink rounded-full px-2.5 py-0.5">Nuevo hoy</span>}
      {l.change && l.change.amount < 0 && (
        <span className="bg-surface-2 text-finance rounded-full px-2.5 py-0.5 tabular-nums">
          Rebaja {pct(l.change.pct, 0)}
        </span>
      )}
      {l.listingState === "retirado" && (
        <span className="bg-surface-2 text-muted rounded-full px-2.5 py-0.5">Retirado</span>
      )}
      {l.status !== "nuevo" && (
        <span className="bg-surface-2 text-muted rounded-full px-2.5 py-0.5">{STATUS_LABELS[l.status]}</span>
      )}
      {l.confidence === "baja" && (
        <span className="bg-surface-2 text-attention rounded-full px-2.5 py-0.5">Confianza baja</span>
      )}
    </div>
  );
}

function ListingCard({ l, rank, grossMin }: { l: EvaluatedListing; rank: number; grossMin: number }) {
  const b = l.ev.base;
  const target = l.ev.purchasePrice !== l.price ? l.ev.purchasePrice : null;
  const stats: { label: string; value: string; className?: string }[] = [
    {
      label: "Bruta",
      value: pct(b?.grossYield),
      className: b && b.grossYield * 100 >= grossMin ? "text-finance" : undefined,
    },
    { label: "Cash flow", value: b ? `${eur(b.cashflowMonth, true)}/mes` : "—", className: tone(b?.cashflowMonth) },
    { label: "Cash-on-cash", value: pct(b?.cashOnCash), className: tone(b?.cashOnCash) },
    { label: "Capital propio", value: eur(b?.equity) },
  ];
  return (
    <Link
      href={`${PAGE}/${l.id}`}
      className={clsx(
        "rounded-tile border-border bg-surface focus-visible:outline-content flex h-full flex-col gap-4 border p-5 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0",
        (l.status === "descartado" || l.listingState === "retirado") && "opacity-60",
      )}
    >
      <div className="flex items-start gap-4">
        <div className="bg-surface-2 rounded-inner flex h-14 w-14 shrink-0 flex-col items-center justify-center">
          <span className="font-display text-xl leading-none font-extrabold tabular-nums">{l.ev.score.total}</span>
          <span className="text-muted text-[10px]">#{rank}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{placeOf(l)}</p>
          <p className="text-muted truncate text-sm">
            {[l.sqm && `${num(l.sqm)} m²`, l.rooms != null && `${l.rooms} hab.`, l.source].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-extrabold tabular-nums">{eur(l.price)}</p>
          {target && <p className="text-muted text-xs tabular-nums">objetivo {eur(target)}</p>}
          {l.sqm && <p className="text-muted text-xs tabular-nums">{eur(l.price / l.sqm)}/m²</p>}
        </div>
      </div>
      <Badges l={l} />
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-2 rounded-inner px-3 py-2">
            <dt className="text-muted text-xs">{s.label}</dt>
            <dd className={clsx("mt-0.5 text-sm font-semibold whitespace-nowrap tabular-nums", s.className)}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {l.ev.discountNeeded != null && l.ev.discountNeeded > 0 && l.ev.maxPrice && (
        <p className="text-muted text-xs tabular-nums">
          Precio máximo {eur(l.ev.maxPrice.max)}: hace falta una rebaja de {eur(l.ev.discountNeeded)} (
          {pct(l.ev.discountNeeded / l.price, 0)}).
        </p>
      )}
      <p className="text-muted mt-auto text-xs">Visto por primera vez el {date(l.firstSeenAt)}</p>
    </Link>
  );
}

function ListingTable({ list }: { list: EvaluatedListing[] }) {
  const head = [
    "#",
    "Zona",
    "Precio",
    "Objetivo",
    "Rebaja necesaria",
    "m²",
    "€/m²",
    "Hab.",
    "Estado",
    "Alquiler cons. / base",
    "Bruta",
    "Neta",
    "Capital",
    "Cuota",
    "Cash flow/mes",
    "CoC",
    "Precio máx.",
    "Puntos",
    "Confianza",
    "Veredicto",
  ];
  return (
    <Tile className="p-0 sm:p-0">
      <div className="relative overflow-x-auto p-4 sm:p-6">
        <table className="w-full min-w-[1500px] text-sm">
          <caption className="sr-only">Ranking de pisos con sus números</caption>
          <thead className="text-muted text-left">
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={clsx("py-2 pr-3 font-medium", i > 1 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((l, i) => {
              const b = l.ev.base;
              const rent = l.data.rent;
              return (
                <tr key={l.id} className="border-border border-t tabular-nums">
                  <td className="text-muted py-2.5 pr-3">{i + 1}</td>
                  <td className="max-w-56 py-2.5 pr-3">
                    <Link href={`${PAGE}/${l.id}`} className="block truncate font-medium hover:underline">
                      {placeOf(l)}
                    </Link>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-muted text-xs hover:underline">
                      {l.source || "anuncio"} ↗
                    </a>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold">{eur(l.price)}</td>
                  <td className="py-2.5 pr-3 text-right">
                    {l.ev.purchasePrice !== l.price ? eur(l.ev.purchasePrice) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {l.ev.discountNeeded
                      ? `${eur(l.ev.discountNeeded)} (${pct(l.ev.discountNeeded / l.price, 0)})`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right">{num(l.sqm)}</td>
                  <td className="py-2.5 pr-3 text-right">{l.sqm ? eur(l.price / l.sqm) : "—"}</td>
                  <td className="py-2.5 pr-3 text-right">{num(l.rooms)}</td>
                  <td className="py-2.5 pr-3 text-right">
                    {l.data.condition === "desconocido" ? "—" : CONDITION_LABELS[l.data.condition]}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {eur(rent.conservative)} / {eur(rent.base)}
                  </td>
                  <td className="py-2.5 pr-3 text-right">{pct(b?.grossYield)}</td>
                  <td className="py-2.5 pr-3 text-right">{pct(b?.netYield)}</td>
                  <td className="py-2.5 pr-3 text-right">{eur(b?.equity)}</td>
                  <td className="py-2.5 pr-3 text-right">{eur(b?.payment)}</td>
                  <td className={clsx("py-2.5 pr-3 text-right", tone(b?.cashflowMonth))}>
                    {eur(b?.cashflowMonth, true)}
                  </td>
                  <td className={clsx("py-2.5 pr-3 text-right", tone(b?.cashOnCash))}>{pct(b?.cashOnCash)}</td>
                  <td className="py-2.5 pr-3 text-right">{eur(l.ev.maxPrice?.max)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold">{l.ev.score.total}</td>
                  <td className="py-2.5 pr-3 text-right capitalize">{l.confidence}</td>
                  <td className={clsx("py-2.5 text-right whitespace-nowrap", VERDICT_TONE[l.ev.verdict].text)}>
                    {VERDICT_LABELS[l.ev.verdict]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Tile>
  );
}

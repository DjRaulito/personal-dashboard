import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { date, dateTime, eur, num, pct, tone, VERDICT_TONE } from "@/components/properties/format";
import { DeleteListingButton, NotesForm, StatusSelect } from "@/components/properties/listing-controls";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import {
  analyze,
  evaluate,
  priceChange,
  rentForGross,
  SCENARIO_LABELS,
  sensitivities,
  VERDICT_LABELS,
  type Analysis,
  type RentScenario,
} from "@/lib/realestate/engine";
import { CONDITION_LABELS, type Provenance } from "@/lib/realestate/schemas";
import { getProperty } from "@/lib/realestate/server";
import { factsOf } from "@/lib/realestate/view";

export const metadata: Metadata = { title: "Piso · Inmuebles" };
export const dynamic = "force-dynamic";

/** Lo que conviene pedir siempre antes de ofertar. */
const STANDARD_DOCUMENTS = [
  "Nota simple del Registro (titularidad y cargas)",
  "Certificado de la comunidad: deudas y derramas aprobadas",
  "Últimas actas de la comunidad",
  "Último recibo del IBI",
  "Cédula de habitabilidad vigente",
  "Certificado de eficiencia energética",
  "Inspección técnica del edificio (ITE / IEE)",
  "Contrato de alquiler y recibos, si está alquilado",
];

const PROVENANCE_STYLE: Record<Provenance, string> = {
  verificado: "text-finance",
  anunciante: "text-muted",
  estimado: "text-attention",
};

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getProperty(id) : null;
  if (!found) notFound();
  const { listing: l, history, settings } = found;
  const { assumptions: a, criteria: c } = settings;
  const facts = factsOf(l);
  const ev = evaluate(facts, a, c, l.confidence);
  const b = ev.base;
  const change = priceChange(history, l.price);
  const place = [l.neighborhood, l.municipality].filter(Boolean).join(", ");
  const v = VERDICT_TONE[ev.verdict];
  const prov = (field: string) => l.data.provenance[field];

  const scenarios = (["conservative", "base", "optimistic"] as RentScenario[]).map((s) => ({
    key: s,
    an: analyze(facts, a, { scenario: s, purchasePrice: ev.purchasePrice }),
  }));
  const alt = analyze(facts, a, { purchasePrice: ev.purchasePrice, ltvPct: a.ltv_alt_pct });
  const stress = sensitivities(facts, a, ev.purchasePrice);

  return (
    <>
      <BackLink href="/finanzas/inmuebles">Inmuebles</BackLink>

      <Tile>
        <div className="flex flex-wrap items-start gap-5">
          {l.data.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- foto externa del portal, sin optimizar
            <img
              src={l.data.photo_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="rounded-inner bg-surface-2 h-32 w-48 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold">{place}</h1>
            {l.title && <p className="text-muted mt-1">{l.title}</p>}
            <p className="text-muted mt-2 text-sm">
              {[
                l.sqm && `${num(l.sqm)} m²`,
                l.rooms != null && `${l.rooms} hab.`,
                l.data.bathrooms != null && `${l.data.bathrooms} baños`,
                l.data.floor && `planta ${l.data.floor}`,
                l.data.elevator != null && (l.data.elevator ? "con ascensor" : "sin ascensor"),
                CONDITION_LABELS[l.data.condition],
                l.data.energy_rating && `energía ${l.data.energy_rating}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-muted mt-1 text-xs">
              Visto el {date(l.firstSeenAt)} · comprobado el {dateTime(l.lastCheckedAt)} ·{" "}
              {l.listingState === "retirado"
                ? "retirado"
                : l.listingState === "activo"
                  ? "activo"
                  : "estado sin confirmar"}{" "}
              · confianza {l.confidence}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-extrabold tabular-nums">{eur(l.price)}</p>
            {l.sqm && <p className="text-muted text-sm tabular-nums">{eur(l.price / l.sqm)}/m²</p>}
            {change && (
              <p className={clsx("text-sm tabular-nums", tone(-change.amount))}>
                {change.amount < 0 ? "Rebaja" : "Subida"} de {eur(Math.abs(change.amount))} ({pct(change.pct, 1)})
              </p>
            )}
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-content mt-2 inline-block text-sm font-medium hover:underline"
            >
              Ver anuncio en {l.source || "el portal"} ↗
            </a>
          </div>
        </div>
      </Tile>

      <section aria-label="Veredicto" className="grid gap-3.5 lg:grid-cols-3">
        <div className={clsx("rounded-tile text-ink p-6 lg:col-span-2", v.bg)}>
          <p className="text-sm font-semibold">Veredicto</p>
          <p className="font-display mt-2 text-3xl font-extrabold">{VERDICT_LABELS[ev.verdict]}</p>
          <p className="mt-1 text-sm font-medium">
            Puntuación {ev.score.total}/100
            {ev.maxPrice && <> · precio máximo {eur(ev.maxPrice.max)}</>}
            {ev.discountNeeded ? (
              <>
                {" "}
                · rebaja necesaria {eur(ev.discountNeeded)} ({pct(ev.discountNeeded / l.price, 1)})
              </>
            ) : null}
          </p>
          {ev.reasons.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm">
              {ev.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs font-medium">
            Orientativo: antes de ofertar hay que verificar documentos, financiación, estado técnico y la renta legal.
          </p>
        </div>
        <Tile>
          <TileTitle>Puntuación</TileTitle>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            {(
              [
                ["Cash flow y cash-on-cash", ev.score.cashflow, c.weights.cashflow],
                ["Rentabilidad neta", ev.score.net_yield, c.weights.net_yield],
                ["Precio frente a comparables", ev.score.price, c.weights.price],
                ["Demanda de alquiler", ev.score.demand, c.weights.demand],
                ["Revalorización", ev.score.appreciation, c.weights.appreciation],
                ["Seguridad", ev.score.safety, c.weights.safety],
              ] as const
            ).map(([label, value, weight]) => {
              const total = Object.values(c.weights).reduce((s, w) => s + w, 0) || 1;
              const max = (weight * 100) / total;
              return (
                <li key={label}>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">{label}</span>
                    <span className="tabular-nums">
                      {num(value, 0)} / {num(max, 0)}
                    </span>
                  </div>
                  <div className="bg-surface-2 mt-1 h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                    <div
                      className="bg-finance h-full rounded-full"
                      style={{ width: `${max ? (value / max) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Tile>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <Tile className="lg:col-span-2">
          <TileTitle>Tu decisión</TileTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-[14rem_1fr]">
            <StatusSelect id={l.id} status={l.status} />
            <NotesForm id={l.id} notes={l.userNotes} discardReason={l.discardReason} />
          </div>
        </Tile>
        <Tile>
          <TileTitle>Precio</TileTitle>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <Row label="Anunciado" value={eur(l.price)} provenance={prov("price")} />
            <Row label="Precio de compra analizado" value={eur(ev.purchasePrice)} />
            {ev.maxPrice && (
              <>
                <Row label={`Máximo por bruta ≥ ${num(c.gross_min_pct, 1)} %`} value={eur(ev.maxPrice.byYield)} />
                <Row label={`Máximo por capital ≤ ${eur(c.max_equity_eur * 100)}`} value={eur(ev.maxPrice.byEquity)} />
                <Row label="Máximo sin cash flow negativo" value={eur(ev.maxPrice.byCashflow)} />
              </>
            )}
          </dl>
          {l.data.negotiation_evidence && (
            <p className="text-muted mt-3 text-sm">
              <span className="text-text font-medium">Para negociar: </span>
              {l.data.negotiation_evidence}
            </p>
          )}
        </Tile>
      </div>

      {!b ? (
        <Tile>
          <TileTitle dot="bg-content">Faltan datos</TileTitle>
          <p className="text-muted mt-2 text-sm">
            Sin una renta estimada con comparables no se pueden calcular los números. La tarea lo completará cuando lo
            encuentre.
          </p>
        </Tile>
      ) : (
        <>
          <Tile>
            <TileTitle>Escenarios al precio de compra</TileTitle>
            <div className="relative mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm tabular-nums">
                <caption className="sr-only">Números por escenario de alquiler</caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-2 text-left font-medium">
                      &nbsp;
                    </th>
                    {scenarios.map((s) => (
                      <th key={s.key} scope="col" className="py-2 text-right font-medium">
                        {SCENARIO_LABELS[s.key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Alquiler mensual", (x: Analysis) => eur(x.rent) + (x.rentCapped ? " (tope)" : "")],
                      ["Rentabilidad bruta", (x: Analysis) => pct(x.grossYield)],
                      ["Rentabilidad neta", (x: Analysis) => pct(x.netYield)],
                      ["Gastos operativos al año", (x: Analysis) => eur(x.opex.total)],
                      ["Cash flow mensual", (x: Analysis) => eur(x.cashflowMonth, true)],
                      ["Cash flow anual", (x: Analysis) => eur(x.cashflowYear, true)],
                      ["Cash-on-cash", (x: Analysis) => pct(x.cashOnCash)],
                    ] as const
                  ).map(([label, fmt]) => (
                    <tr key={label} className="border-border border-t">
                      <th scope="row" className="text-muted py-2 text-left font-normal">
                        {label}
                      </th>
                      {scenarios.map((s) => (
                        <td key={s.key} className="py-2 text-right">
                          {s.an ? fmt(s.an) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted mt-3 text-xs">
              Renta necesaria para un {num(c.gross_min_pct, 1)} % bruto:{" "}
              {eur(rentForGross(ev.purchasePrice, c.gross_min_pct))}
              /mes · para un {num(c.gross_target_pct, 1)} %: {eur(rentForGross(ev.purchasePrice, c.gross_target_pct))}
              /mes.
              {l.data.rent_cap != null && <> Tope legal: {eur(l.data.rent_cap)}/mes.</>}
            </p>
            {l.data.rent_cap_note && <p className="text-muted mt-1 text-xs">{l.data.rent_cap_note}</p>}
          </Tile>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Tile>
              <TileTitle>Capital necesario</TileTitle>
              <dl className="mt-4 flex flex-col gap-2 text-sm">
                <Row label="Precio de compra" value={eur(b.purchasePrice)} />
                <Row label={`ITP (${num(a.itp_pct, 1)} %)`} value={eur(b.itp)} />
                <Row label="Notaría, registro, gestoría y tasación" value={eur(b.purchaseCosts)} />
                <Row
                  label={`Reforma (+${num(a.reform_contingency_pct)} % imprevistos)`}
                  value={eur(b.reform)}
                  provenance={prov("reform_cost")}
                />
                <Row label="Mobiliario" value={eur(b.furnishing)} />
                <Row label="Cédula, certificados y altas" value={eur(b.setup)} />
                <Row label="Coste total" value={eur(b.totalCost)} strong />
                <Row label={`Hipoteca (${num(b.ltvPct)} % del precio)`} value={`− ${eur(b.loan)}`} />
                <Row
                  label="Capital propio"
                  value={eur(b.equity)}
                  strong
                  className={b.equity > c.max_equity_eur * 100 ? "text-expense" : "text-finance"}
                />
              </dl>
            </Tile>
            <Tile>
              <TileTitle>Financiación</TileTitle>
              <p className="text-muted mt-1 text-sm">
                {num(a.interest_pct, 2)} % fijo a {a.term_years} años (supuesto editable). No da por aprobada la
                hipoteca.
              </p>
              <div className="relative mt-4 overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">Comparación de financiación</caption>
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="py-2 text-left font-medium">
                        &nbsp;
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {num(b.ltvPct)} %
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {num(a.ltv_alt_pct)} %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Préstamo", (x: Analysis) => eur(x.loan)],
                        ["Cuota mensual", (x: Analysis) => eur(x.payment)],
                        ["Capital propio", (x: Analysis) => eur(x.equity)],
                        ["Cash flow mensual", (x: Analysis) => eur(x.cashflowMonth, true)],
                        ["Cash-on-cash", (x: Analysis) => pct(x.cashOnCash)],
                      ] as const
                    ).map(([label, fmt]) => (
                      <tr key={label} className="border-border border-t">
                        <th scope="row" className="text-muted py-2 text-left font-normal">
                          {label}
                        </th>
                        <td className="py-2 text-right">{fmt(b)}</td>
                        <td className="py-2 text-right">{alt ? fmt(alt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tile>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Tile>
              <TileTitle>Gastos operativos al año (base)</TileTitle>
              <dl className="mt-4 flex flex-col gap-2 text-sm">
                <Row label={`Vacancia (${num(a.vacancy_months, 1)} meses)`} value={eur(b.opex.vacancy)} />
                <Row label="Comunidad" value={eur(b.opex.community)} provenance={prov("community_fee")} />
                <Row label="IBI" value={eur(b.opex.ibi)} provenance={prov("ibi")} />
                <Row label="Seguro del hogar" value={eur(b.opex.insurance)} />
                <Row label={`Mantenimiento (${num(a.maintenance_pct, 1)} %)`} value={eur(b.opex.maintenance)} />
                <Row label={`Gestión (${num(a.management_pct, 1)} %)`} value={eur(b.opex.management)} />
                <Row
                  label={`Seguro de impago (${num(a.default_insurance_pct, 1)} %)`}
                  value={eur(b.opex.defaultInsurance)}
                />
                <Row label="Total" value={eur(b.opex.total)} strong />
              </dl>
              <p className="text-muted mt-3 text-xs">
                La cuota de la hipoteca entera va al cash flow, no a estos gastos.
              </p>
            </Tile>
            <Tile>
              <TileTitle>Sensibilidades</TileTitle>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {stress.map((s) => (
                  <li
                    key={s.label}
                    className="bg-surface-2 rounded-inner flex flex-wrap justify-between gap-2 px-3 py-2"
                  >
                    <span className="text-muted">{s.label}</span>
                    <span className="tabular-nums">
                      <span className={tone(s.analysis.cashflowMonth)}>{eur(s.analysis.cashflowMonth, true)}/mes</span>
                      <span className="text-muted"> · CoC {pct(s.analysis.cashOnCash)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Tile>
          </div>
        </>
      )}

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Tile>
          <TileTitle dot="bg-content">Datos del anuncio</TileTitle>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <Row label="Precio" value={eur(l.price)} provenance={prov("price")} />
            <Row label="Superficie" value={l.sqm ? `${num(l.sqm)} m²` : "—"} provenance={prov("sqm")} />
            <Row label="Habitaciones" value={num(l.rooms)} provenance={prov("rooms")} />
            <Row label="Estado" value={CONDITION_LABELS[l.data.condition]} provenance={prov("condition")} />
            <Row
              label="Alquiler conservador / base / optimista"
              value={`${eur(l.data.rent.conservative)} / ${eur(l.data.rent.base)} / ${eur(l.data.rent.optimistic)}`}
              provenance={prov("rent")}
            />
            <Row label="Tope legal de renta" value={eur(l.data.rent_cap)} provenance={prov("rent_cap")} />
            <Row
              label="€/m² de mercado en la zona"
              value={eur(l.data.market_price_sqm)}
              provenance={prov("market_price_sqm")}
            />
            <Row label="Comunidad al mes" value={eur(l.data.community_fee)} provenance={prov("community_fee")} />
            <Row label="IBI al año" value={eur(l.data.ibi)} provenance={prov("ibi")} />
            <Row label="Publicado" value={date(l.data.published_on)} />
          </dl>
          <p className="text-muted mt-3 text-xs">
            <span className="text-finance">verificado</span> · anunciante ·{" "}
            <span className="text-attention">estimado</span>. Sin marca: origen no indicado.
          </p>
        </Tile>
        <Tile>
          <TileTitle dot="bg-content">Tesis y riesgos</TileTitle>
          {l.data.thesis ? (
            <p className="mt-3 text-sm">{l.data.thesis}</p>
          ) : (
            <p className="text-muted mt-3 text-sm">Sin tesis.</p>
          )}
          <TextList title="Riesgos" items={l.data.risks} />
          <TextList title="Pendiente de validar" items={l.data.pending} />
          <TextList title="Próximos pasos" items={l.data.next_steps} />
        </Tile>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Comparables title="Comparables de alquiler" items={l.data.rent_comparables} monthly />
        <Comparables title="Comparables de venta" items={l.data.sale_comparables} />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Tile>
          <TileTitle dot="bg-attention">Documentos a pedir</TileTitle>
          <ul className="mt-3 list-disc pl-5 text-sm">
            {[...new Set([...l.data.documents, ...STANDARD_DOCUMENTS])].map((d) => (
              <li key={d} className="py-0.5">
                {d}
              </li>
            ))}
          </ul>
        </Tile>
        <Tile>
          <TileTitle dot="bg-content">Historial de precio</TileTitle>
          {history.length === 0 ? (
            <p className="text-muted mt-3 text-sm">Sin cambios registrados.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-1.5 text-sm tabular-nums">
              {history.map((h) => (
                <li key={h.seen_at} className="flex justify-between gap-3">
                  <span className="text-muted">{date(h.seen_at)}</span>
                  <span>{eur(h.price)}</span>
                </li>
              ))}
            </ol>
          )}
          {l.data.duplicates.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-medium">También anunciado en</h3>
              <ul className="mt-1 text-sm">
                {l.data.duplicates.map((u) => (
                  <li key={u} className="truncate">
                    <a href={u} target="_blank" rel="noreferrer" className="text-content hover:underline">
                      {hostOf(u)} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tile>
      </div>

      <div className="flex justify-end">
        <DeleteListingButton id={l.id} />
      </div>
    </>
  );
}

function Row({
  label,
  value,
  provenance,
  strong,
  className,
}: {
  label: string;
  value: string;
  provenance?: Provenance;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-3", strong && "border-border border-t pt-2")}>
      <dt className="text-muted">{label}</dt>
      <dd className={clsx("text-right tabular-nums", strong && "font-semibold", className)}>
        {value}
        {provenance && <span className={clsx("ml-2 text-xs", PROVENANCE_STYLE[provenance])}>{provenance}</span>}
      </dd>
    </div>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      <ul className="text-muted mt-1 list-disc pl-5 text-sm">
        {items.map((i) => (
          <li key={i} className="py-0.5">
            {i}
          </li>
        ))}
      </ul>
    </>
  );
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function Comparables({
  title,
  items,
  monthly,
}: {
  title: string;
  items: { url?: string; price: number; sqm?: number; note?: string }[];
  monthly?: boolean;
}) {
  return (
    <Tile>
      <TileTitle dot="bg-content">{title}</TileTitle>
      {items.length === 0 ? (
        <p className="text-muted mt-3 text-sm">Sin comparables.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {items.map((c, i) => (
            <li
              key={`${c.url ?? ""}${i}`}
              className="bg-surface-2 rounded-inner flex flex-wrap justify-between gap-2 px-3 py-2"
            >
              <span className="min-w-0">
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-content hover:underline">
                    {hostOf(c.url)} ↗
                  </a>
                ) : (
                  <span className="text-muted">Sin enlace</span>
                )}
                {c.note && <span className="text-muted block text-xs">{c.note}</span>}
              </span>
              <span className="text-right tabular-nums">
                {eur(c.price)}
                {monthly ? "/mes" : ""}
                {c.sqm && (
                  <span className="text-muted block text-xs">
                    {num(c.sqm)} m² · {eur(c.price / c.sqm)}/m²{monthly ? "/mes" : ""}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { FUND_BASE, signTone, Stat } from "@/components/tasks/fund-views";
import { MarkSeen } from "@/components/tasks/mark-seen";
import { PriceChart, type PriceLevel } from "@/components/tasks/price-chart";
import { shortDate } from "@/components/tasks/task-items";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { yahooDailyCloses } from "@/lib/investments/yahoo";
import {
  formatPct,
  formatPrice,
  FUND_SLUG,
  fundPosition,
  pctChange,
  sinceBuy,
  sizeLabel,
  toEntry,
  upside,
  upsideFromEntry,
} from "@/lib/tasks/fund";
import { getTask, type TaskItem } from "@/lib/tasks/server";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const task = await getTask(FUND_SLUG);
  return task?.items.find((i) => i.id === id) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = await load((await params).id);
  return { title: item ? `${fundPosition(item.key, item.data).name} · Fondo value` : "Fondo value" };
}

/** Cierres de un año (Yahoo); si no responde, los precios que la tarea fue guardando. */
async function priceHistory(item: TaskItem) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  try {
    const { points } = await yahooDailyCloses(item.key, from, to);
    if (points.length > 1) return { points, source: "Cierres diarios de Yahoo Finance, último año" };
  } catch {
    // sin conexión con Yahoo: se usa lo guardado
  }
  const saved = [...item.history]
    .reverse()
    .map((h) => ({ date: h.at.slice(0, 10), value: h.data.precio }))
    .concat({ date: item.lastSeenAt.slice(0, 10), value: item.data.precio })
    .filter((p): p is { date: string; value: number } => typeof p.value === "number");
  const byDay = [...new Map(saved.map((p) => [p.date, p])).values()];
  return { points: byDay, source: "Precios que la tarea ha ido guardando" };
}

/** Lo que dijo la tarea cada día sobre la empresa (sin repetir). */
function diary(item: TaskItem) {
  const entries = [{ at: item.lastSeenAt, note: item.data.nota }].concat(
    item.history.map((h) => ({ at: h.at, note: h.data.nota })),
  );
  const seen = new Set<string>();
  return entries.filter((e): e is { at: string; note: string } => {
    if (typeof e.note !== "string" || !e.note.trim() || seen.has(e.note)) return false;
    seen.add(e.note);
    return true;
  });
}

function TextBlock({ title, children }: { title: string; children: string | null }) {
  if (!children) return null;
  return (
    <div>
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-pretty">{children}</p>
    </div>
  );
}

export default async function FundPositionPage({ params }: Params) {
  const item = await load((await params).id);
  if (!item) notFound();
  const p = fundPosition(item.key, item.data);
  const inPortfolio = p.state === "cartera";
  const { points, source } = await priceHistory(item);
  const levels: PriceLevel[] = [
    inPortfolio && p.buy != null && { label: "Compra", value: p.buy, tone: "border-content text-content" },
    p.entryMax != null && { label: "Entrada máx.", value: p.entryMax, tone: "border-attention text-attention" },
    p.target != null && { label: "Salida", value: p.target, tone: "border-up text-up" },
    p.bear != null && { label: "Bajista", value: p.bear, tone: "border-down text-down" },
  ].filter((l): l is PriceLevel => Boolean(l));
  const ret = sinceBuy(p);
  const up = upside(p);
  const gap = toEntry(p);
  const scenarios = [
    { name: "Bajista", price: p.bear, prob: p.probs.bear },
    { name: "Base (salida)", price: p.target, prob: p.probs.base },
    { name: "Alcista", price: p.bull, prob: p.probs.bull },
  ].filter((s) => s.price != null);
  const notes = diary(item);

  return (
    <div className="flex flex-col gap-3.5">
      <MarkSeen id={item.id} status={item.status} />
      <BackLink href={inPortfolio ? FUND_BASE : `${FUND_BASE}/vigilancia`}>
        {inPortfolio ? "Cartera" : "Vigilancia"}
      </BackLink>

      <Tile>
        <p className="text-muted text-xs font-semibold tracking-wide uppercase">
          {inPortfolio ? "En cartera" : p.state === "vigilancia" ? "En vigilancia" : p.state}
          {item.removedAt && " · retirada"}
        </p>
        <h3 className="mt-1 text-2xl font-bold">{p.name}</h3>
        <p className="text-muted mt-1 text-sm">
          {[p.ticker, p.market, p.country, sizeLabel(p.size), p.cap && `Cap. ${p.cap}`].filter(Boolean).join(" · ")}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Hoy"
            value={formatPrice(p.price, p.currency)}
            big
            hint={`Visto el ${shortDate(item.lastSeenAt)}`}
          />
          {inPortfolio ? (
            <Stat
              label="Entró a"
              value={formatPrice(p.buy, p.currency)}
              hint={
                <>
                  <span className={signTone(ret)}>{formatPct(ret)}</span>
                  {p.buyDate && ` · ${shortDate(p.buyDate)}`}
                </>
              }
            />
          ) : (
            <Stat
              label="Entrar por debajo de"
              value={formatPrice(p.entryMax, p.currency)}
              hint={
                gap == null ? undefined : gap >= 0 ? "✓ Ya está por debajo" : `Le falta caer ${formatPct(-gap, false)}`
              }
            />
          )}
          <Stat label="Precio de salida" value={formatPrice(p.target, p.currency)} hint="escenario base" />
          <Stat
            label="Revalorización"
            value={formatPct(up)}
            tone={signTone(up)}
            hint={inPortfolio ? "desde hoy" : `desde la entrada ${formatPct(upsideFromEntry(p))}`}
          />
          <Stat label="EV" value={formatPct(p.ev)} hint="valor esperado 12-24 m" />
          {inPortfolio ? (
            <Stat label="Peso" value={formatPct(p.weight, false)} hint="de la cartera" />
          ) : (
            <Stat label="Tamaño" value={sizeLabel(p.size) ?? "—"} hint={p.cap ?? undefined} />
          )}
        </dl>
      </Tile>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tile>
          <TileTitle>Precio</TileTitle>
          <div className="mt-4">
            {points.length > 1 ? (
              <PriceChart points={points} levels={levels} currency={p.currency} />
            ) : (
              <p className="text-muted text-sm">Aún no hay suficientes precios para dibujar el gráfico.</p>
            )}
          </div>
          <p className="text-muted mt-3 text-xs">{source}.</p>
        </Tile>

        <Tile>
          <TileTitle dot="bg-content">Escenarios</TileTitle>
          {scenarios.length === 0 ? (
            <p className="text-muted mt-3 text-sm">La tarea aún no ha guardado los escenarios.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-muted text-left text-xs">
                  <th scope="col" className="py-1.5 font-medium">
                    Escenario
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Precio
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Desde hoy
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    Prob.
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const r = pctChange(p.price, s.price);
                  return (
                    <tr key={s.name} className="border-border border-t">
                      <th scope="row" className="py-2 text-left font-medium">
                        {s.name}
                      </th>
                      <td className="py-2 text-right tabular-nums">{formatPrice(s.price, p.currency)}</td>
                      <td className={`py-2 text-right tabular-nums ${signTone(r)}`}>{formatPct(r)}</td>
                      <td className="py-2 text-right tabular-nums">{formatPct(s.prob, false)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-muted mt-3 text-xs">
            EV = suma de probabilidad × rentabilidad de cada escenario. Las probabilidades son una estimación de la
            tarea.
          </p>
        </Tile>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tile>
          <TileTitle>Por qué entra</TileTitle>
          <div className="mt-4 flex flex-col gap-4">
            {p.thesis || p.catalyst || p.risks || p.exitIf ? (
              <>
                <TextBlock title="Tesis">{p.thesis}</TextBlock>
                <TextBlock title="Catalizador">{p.catalyst}</TextBlock>
                <TextBlock title="Riesgos">{p.risks}</TextBlock>
                <TextBlock title="Sale si">{p.exitIf}</TextBlock>
                <TextBlock title="Próximo evento">{p.nextEvent}</TextBlock>
              </>
            ) : (
              <p className="text-muted text-sm">La tarea guardará la tesis en su próxima ejecución.</p>
            )}
            {p.link && (
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-finance inline-flex items-center gap-1 self-start text-sm"
              >
                Fuente principal <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </Tile>

        <Tile>
          <TileTitle dot="bg-content">Diario</TileTitle>
          {notes.length === 0 ? (
            <p className="text-muted mt-3 text-sm">Sin notas todavía.</p>
          ) : (
            <ol className="mt-3 flex flex-col">
              {notes.map((n) => (
                <li key={n.at} className="border-border border-t py-2.5 text-sm first:border-t-0">
                  <time className="text-muted text-xs" dateTime={n.at}>
                    {shortDate(n.at)}
                  </time>
                  <p className="mt-0.5 text-pretty">{n.note}</p>
                </li>
              ))}
            </ol>
          )}
        </Tile>
      </div>
    </div>
  );
}

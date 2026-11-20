"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteAsset, deleteOperation, updateOperation } from "@/app/(app)/finanzas/inversiones/actions";
import { closeSheet, Sheet } from "@/components/sheet";
import { buttonClass, EmptyState, inputClass } from "@/components/ui";
import { OPERATION_LABELS, type BoardAsset, type BoardOperation } from "@/lib/investments/board";
import { trendClass } from "@/lib/trend";
import { AssetSettings } from "./asset-settings";
import { TradeForm, tradeTitle, type TradeMode } from "./trade-form";

const eur = (v: number, signed = false) =>
  `${signed && v > 0 ? "+" : ""}${v.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`.replace("-", "−");
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;
const num = (v: number | null | undefined, digits = 4) =>
  v == null ? "—" : v.toLocaleString("es-ES", { maximumFractionDigits: digits });
const day = (d: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

type Dialog =
  { kind: "trade"; mode: TradeMode } | { kind: "edit"; asset: BoardAsset } | { kind: "delete"; asset: BoardAsset };

/** Lista de posiciones (abiertas y cerradas) con su menú, el panel de cada una y los formularios. */
export function PositionsBoard({
  assets,
  today,
  initialAssetId,
}: {
  assets: BoardAsset[];
  today: string;
  initialAssetId: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [selected, setSelected] = useState<string | null>(initialAssetId);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const open = assets.filter((a) => a.open);
  const closed = assets
    .filter((a) => !a.open && a.operations.length > 0)
    .sort((x, y) => (y.closedOn ?? "").localeCompare(x.closedOn ?? ""));
  const list = tab === "open" ? open : closed;
  const current = assets.find((a) => a.id === selected) ?? null;

  const actions = (a: BoardAsset) => ({
    buy: () => setDialog({ kind: "trade", mode: { kind: "buy", asset: a } }),
    sell: () => setDialog({ kind: "trade", mode: { kind: "sell", asset: a } }),
    close: () => setDialog({ kind: "trade", mode: { kind: "close", asset: a } }),
    operation: () => setDialog({ kind: "trade", mode: { kind: "operation", asset: a } }),
    edit: () => setDialog({ kind: "edit", asset: a }),
    remove: () => setDialog({ kind: "delete", asset: a }),
  });

  return (
    <section aria-labelledby="posiciones" className="rounded-tile border-border bg-surface border p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="posiciones" className="sr-only">
          Posiciones
        </h2>
        <div role="tablist" aria-label="Posiciones" className="bg-surface-2 flex rounded-full p-1">
          {(
            [
              ["open", `Abiertas (${open.length})`],
              ["closed", `Cerradas (${closed.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                tab === id ? "bg-finance text-ink" : "text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* En escritorio, arriba a la derecha de la lista; en móvil, botón fijo abajo */}
        <button
          type="button"
          onClick={() => setDialog({ kind: "trade", mode: { kind: "new" } })}
          className={clsx(
            buttonClass.primary,
            "fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 shadow-lg md:static md:ml-auto md:shadow-none",
          )}
        >
          <Plus aria-hidden="true" className="h-4 w-4" /> Nueva compra
        </button>
      </div>

      {notice && (
        <p role="status" className="bg-surface-2 text-finance rounded-inner mt-4 px-4 py-2.5 text-sm">
          ✓ {notice}
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState>
          {tab === "open" ? "No tienes posiciones abiertas." : "Aún no has cerrado ninguna posición."}
        </EmptyState>
      ) : (
        <ul className="mt-3 flex flex-col">
          {list.map((a) => (
            <PositionRow key={a.id} asset={a} onOpen={() => setSelected(a.id)} actions={actions(a)} />
          ))}
        </ul>
      )}

      {current && !dialog && (
        <Sheet title={current.name} side onClose={() => setSelected(null)}>
          <PositionPanel asset={current} actions={actions(current)} />
        </Sheet>
      )}

      {dialog?.kind === "trade" && (
        <Sheet title={tradeTitle(dialog.mode)} onClose={() => setDialog(null)}>
          <TradeForm
            mode={dialog.mode}
            assets={assets}
            today={today}
            onDone={(assetId, message) => {
              setNotice(message);
              setSelected(assetId);
              router.refresh();
            }}
          />
        </Sheet>
      )}
      {dialog?.kind === "edit" && (
        <Sheet title={`Editar · ${dialog.asset.name}`} onClose={() => setDialog(null)}>
          <AssetSettings
            asset={{
              id: dialog.asset.id,
              name: dialog.asset.name,
              isin: dialog.asset.isin,
              kind: dialog.asset.kind,
              price_source: dialog.asset.priceSource,
              price_symbol: dialog.asset.priceSymbol,
              currency: dialog.asset.currency,
            }}
            today={today}
          />
        </Sheet>
      )}
      {dialog?.kind === "delete" && (
        <Sheet title={`Eliminar · ${dialog.asset.name}`} onClose={() => setDialog(null)}>
          <DeleteAsset
            asset={dialog.asset}
            onDone={(message) => {
              setNotice(message);
              setSelected(null);
              router.refresh();
            }}
          />
        </Sheet>
      )}
    </section>
  );
}

type Actions = Record<"buy" | "sell" | "close" | "operation" | "edit" | "remove", () => void>;

function PositionRow({ asset: a, onOpen, actions }: { asset: BoardAsset; onOpen: () => void; actions: Actions }) {
  const gain = a.valueEur - a.costEur;
  return (
    <li className="border-border flex items-center gap-2 border-t first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
        className="hover:bg-surface-2 rounded-inner grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-2 py-3 text-left sm:grid-cols-[minmax(0,1fr)_7rem_8rem]"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{a.name}</span>
          <span className="text-muted block text-xs tabular-nums">
            {a.open ? `${num(a.quantity)} part.` : a.closedOn ? `Cerrada el ${day(a.closedOn)}` : "Cerrada"}
          </span>
        </span>
        <span className="hidden text-right font-semibold tabular-nums sm:block">
          {a.open ? eur(a.valueEur) : eur(a.resultEur, true)}
        </span>
        <span className="text-right tabular-nums">
          <span className="font-semibold sm:hidden">{a.open ? eur(a.valueEur) : ""}</span>
          <span className={clsx("block text-sm", trendClass(a.open ? gain : a.resultEur))}>
            {a.open ? eur(gain, true) : <span className="sm:hidden">{eur(a.resultEur, true)}</span>}
          </span>
          {a.open && (
            <span className={clsx("block text-xs", trendClass(gain))}>{a.costEur ? pct(gain / a.costEur) : "—"}</span>
          )}
        </span>
      </button>
      <RowMenu asset={a} actions={actions} />
    </li>
  );
}

/** Menú «…» de una fila. */
function RowMenu({ asset, actions }: { asset: BoardAsset; actions: Actions }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  const item = (label: string, run: () => void, danger = false) => (
    <li>
      <button
        type="button"
        onClick={() => {
          if (ref.current) ref.current.open = false;
          run();
        }}
        className={clsx("hover:bg-surface-2 w-full px-4 py-2.5 text-left text-sm", danger && "text-expense")}
      >
        {label}
      </button>
    </li>
  );
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={`Acciones de ${asset.name}`}
        className="hover:bg-surface-2 focus-visible:outline-content flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full focus-visible:outline-2 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
      </summary>
      <ul className="bg-surface-2 border-border-strong rounded-inner absolute right-0 z-20 mt-1 w-52 overflow-hidden border py-1 shadow-xl">
        {item("Comprar más", actions.buy)}
        {asset.open && item("Vender", actions.sell)}
        {asset.open && item("Cerrar posición", actions.close)}
        {item("Editar", actions.edit)}
        {item("Eliminar", actions.remove, true)}
      </ul>
    </details>
  );
}

function PositionPanel({ asset: a, actions }: { asset: BoardAsset; actions: Actions }) {
  const gain = a.valueEur - a.costEur;
  const stats: [string, React.ReactNode, string?][] = a.open
    ? [
        ["Participaciones", num(a.quantity)],
        ["Coste medio", a.avgCostEur == null ? "—" : `${num(a.avgCostEur)} €`],
        ["Precio actual", a.lastPrice == null ? "—" : `${num(a.lastPrice)} ${a.currency}`],
        ["Valor", eur(a.valueEur)],
        [
          "Plusvalía",
          <>
            {eur(gain, true)}
            <span className="block text-sm">{a.costEur ? pct(gain / a.costEur) : "—"}</span>
          </>,
          trendClass(gain),
        ],
        ["Realizada + dividendos", eur(a.realizedEur + a.dividendsEur - a.feesEur, true)],
      ]
    : [
        ["Resultado final", eur(a.resultEur, true), trendClass(a.resultEur)],
        ["Plusvalía realizada", eur(a.realizedEur, true)],
        ["Dividendos", eur(a.dividendsEur)],
        ["Comisiones", eur(a.feesEur)],
      ];
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-2">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="bg-surface-2 rounded-inner px-3 py-2.5">
            <dt className="text-muted text-xs">{label}</dt>
            <dd className={clsx("mt-0.5 font-semibold tabular-nums", tone)}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="bg-surface-2 rounded-inner flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1">
          <span className="text-muted block text-xs">Origen del precio</span>
          {a.priceOrigin}
        </span>
        <button
          type="button"
          onClick={actions.edit}
          className="text-finance text-sm font-semibold underline-offset-4 hover:underline"
        >
          Cambiar fuente
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={actions.buy} className={buttonClass.primary}>
          Comprar más
        </button>
        {a.open && (
          <button type="button" onClick={actions.sell} className={buttonClass.secondary}>
            Vender
          </button>
        )}
        {a.open && (
          <button type="button" onClick={actions.close} className={buttonClass.secondary}>
            Cerrar posición
          </button>
        )}
        <button type="button" onClick={actions.edit} className={buttonClass.secondary}>
          Editar
        </button>
        <button type="button" onClick={actions.remove} className={buttonClass.danger}>
          Eliminar
        </button>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Operaciones ({a.operations.length})</h3>
          <button type="button" onClick={actions.operation} className={clsx(buttonClass.secondary, "ml-auto")}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Añadir operación
          </button>
        </div>
        <ul className="mt-2 flex flex-col">
          {[...a.operations].reverse().map((op) => (
            <OperationRow key={op.id} op={op} currency={a.currency} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function OperationRow({ op, currency }: { op: BoardOperation; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(op.date);
  const [quantity, setQuantity] = useState(String(op.quantity).replace(".", ","));
  const [price, setPrice] = useState(op.price == null ? "" : String(op.price).replace(".", ","));
  const [amount, setAmount] = useState(String(Math.abs(op.cashEur)).replace(".", ","));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const trade = op.type === "buy" || op.type === "sell";

  if (editing) {
    return (
      <li className="border-border flex flex-col gap-2 border-t py-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="Fecha"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
          {trade ? (
            <>
              <input
                aria-label="Participaciones"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={clsx(inputClass, "tabular-nums")}
              />
              <input
                aria-label={`Precio (${currency})`}
                placeholder={`Precio (${currency})`}
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={clsx(inputClass, "tabular-nums")}
              />
            </>
          ) : (
            <input
              aria-label="Importe (€)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={clsx(inputClass, "tabular-nums")}
            />
          )}
        </div>
        {error && (
          <p role="alert" className="text-attention text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateOperation({
                  id: op.id,
                  date,
                  quantity: trade ? quantity : "0",
                  price: trade ? price : null,
                  amount: trade ? null : amount,
                });
                if (!r.ok) return setError(r.message);
                setEditing(false);
                router.refresh();
              })
            }
            className={buttonClass.primary}
          >
            <Check aria-hidden="true" className="h-4 w-4" /> Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)} className={buttonClass.secondary}>
            <X aria-hidden="true" className="h-4 w-4" /> Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="border-border flex items-center gap-2 border-t py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{OPERATION_LABELS[op.type]}</span>
        {op.isSplit && <span className="text-muted"> · ajuste de títulos</span>}
        <span className="text-muted block text-xs tabular-nums">
          {day(op.date)}
          {trade && ` · ${num(op.quantity)} × ${num(op.price)} ${currency}`}
          {op.source !== "manual" && ` · importada`}
        </span>
      </span>
      <span className="tabular-nums">{eur(-op.cashEur, true)}</span>
      <button
        type="button"
        aria-label="Editar operación"
        onClick={() => setEditing(true)}
        className="hover:bg-surface-2 text-muted hover:text-text rounded-full p-2"
      >
        <Pencil aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Borrar operación"
        disabled={pending}
        onClick={() => {
          if (!confirm("¿Borrar esta operación?")) return;
          start(async () => {
            await deleteOperation(op.id);
            router.refresh();
          });
        }}
        className="hover:bg-surface-2 text-muted hover:text-expense rounded-full p-2"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </li>
  );
}

function DeleteAsset({ asset, onDone }: { asset: BoardAsset; onDone: (message: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = asset.operations.length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Se borra <strong>{asset.name}</strong> con{" "}
        <strong>
          {n} {n === 1 ? "operación" : "operaciones"}
        </strong>{" "}
        y sus precios. No se puede deshacer.
      </p>
      {error && (
        <p role="alert" className="text-attention text-sm">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          const el = e.currentTarget;
          start(async () => {
            const r = await deleteAsset(asset.id);
            if (!r.ok) return setError(r.message);
            onDone(r.message);
            closeSheet(el);
          });
        }}
        className={clsx(buttonClass.danger, "border-expense self-start border")}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" /> {pending ? "Borrando…" : `Eliminar y borrar ${n} operaciones`}
      </button>
    </div>
  );
}

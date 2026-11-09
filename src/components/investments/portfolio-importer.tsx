"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { importPortfolio, type PortfolioImportResult } from "@/app/(app)/finanzas/inversiones/actions";
import { buttonClass, Field, inputClass } from "@/components/ui";
import { parseInvestingCsv, type InvestingExport } from "@/lib/investments/investing-csv";
import {
  parseFundOrdersCsv,
  parseStockOperationsHtml,
  type FundOrder,
  type StockOperation,
} from "@/lib/investments/myinvestor";
import { reconcile } from "@/lib/investments/reconcile";
import { decodeText } from "@/lib/finance/read-sheet";

type Slot = "investing" | "orders" | "stocks";

const SLOTS: { key: Slot; label: string; hint: string; accept: string }[] = [
  {
    key: "investing",
    label: "Cartera de Investing (CSV)",
    hint: "Investing → Mi cartera → Exportar. Da las posiciones y lo que no está en otros archivos (p. ej. MEXEM).",
    accept: ".csv",
  },
  {
    key: "orders",
    label: "Órdenes de fondos de MyInvestor (CSV)",
    hint: "MyInvestor → Fondos → Órdenes → Descargar. Da el ISIN y el importe exacto de cada orden.",
    accept: ".csv",
  },
  {
    key: "stocks",
    label: "Operaciones de valores de MyInvestor (.xls)",
    hint: "MyInvestor → Bolsa → Operaciones → Exportar. Compras, ventas, dividendos y contrasplits.",
    accept: ".xls,.html,.htm",
  },
];

export function PortfolioImporter() {
  const [investing, setInvesting] = useState<InvestingExport | null>(null);
  const [orders, setOrders] = useState<FundOrder[]>([]);
  const [stocks, setStocks] = useState<StockOperation[]>([]);
  const [loaded, setLoaded] = useState<Record<Slot, string | null>>({ investing: null, orders: null, stocks: null });
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PortfolioImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(slot: Slot, file: File | undefined) {
    setError(null);
    setResult(null);
    if (!file) return;
    try {
      const text = decodeText(await file.arrayBuffer());
      if (slot === "investing") {
        const parsed = parseInvestingCsv(text);
        if (!parsed.holdings.length && !parsed.closedLots.length)
          throw new Error("No parece una exportación de Investing.");
        setInvesting(parsed);
      } else if (slot === "orders") {
        const parsed = parseFundOrdersCsv(text);
        if (!parsed.length) throw new Error("No encontré órdenes finalizadas en el archivo.");
        setOrders(parsed);
      } else {
        const parsed = parseStockOperationsHtml(text);
        if (!parsed.length) throw new Error("No encontré operaciones de valores en el archivo.");
        setStocks(parsed);
      }
      setLoaded((l) => ({ ...l, [slot]: file.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  const rec = useMemo(
    () =>
      investing || orders.length || stocks.length
        ? reconcile({ investing, fundOrders: orders, stockOps: stocks })
        : null,
    [investing, orders, stocks],
  );

  const doubtKey = (o: { date: string; isin: string; units: number }) => `myif:${o.date}:${o.isin}:${o.units}`;
  const operations = useMemo(
    () =>
      (rec?.operations ?? []).map((op) => {
        const base = op.externalId.replace(/:\d+$/, "");
        if (!flipped.has(base)) return op;
        return {
          ...op,
          type: op.type === "buy" ? ("sell" as const) : ("buy" as const),
          cashEur: op.cashEur == null ? null : -op.cashEur,
          grossLocal: op.grossLocal == null ? null : -op.grossLocal,
        };
      }),
    [rec, flipped],
  );

  const summary = useMemo(() => {
    if (!rec) return [];
    return rec.assets
      .map((a) => {
        const ops = operations.filter((o) => o.assetKey === a.key);
        const qty = ops.reduce((s, o) => s + (o.type === "buy" ? o.quantity : o.type === "sell" ? -o.quantity : 0), 0);
        return { ...a, ops: ops.length, qty: Math.abs(qty) < 1e-4 ? 0 : qty };
      })
      .sort((x, y) => Number(y.qty > 0) - Number(x.qty > 0) || x.name.localeCompare(y.name, "es"));
  }, [rec, operations]);

  function save() {
    if (!rec) return;
    startTransition(async () => {
      setResult(await importPortfolio({ assets: rec.assets, operations }));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {SLOTS.map((s) => (
          <Field key={s.key} label={s.label}>
            <input
              type="file"
              accept={s.accept}
              onChange={(e) => onFile(s.key, e.target.files?.[0])}
              className={`${inputClass} file:bg-surface file:text-text file:mr-3 file:rounded-full file:border-0 file:px-3 file:py-1`}
            />
            <span className="text-muted text-xs">{loaded[s.key] ? `✓ ${loaded[s.key]}` : s.hint}</span>
          </Field>
        ))}
      </div>
      <p className="text-muted -mt-3 text-xs">
        Los archivos se leen en tu navegador. Puedes subir solo los que tengas; volver a importar no duplica
        operaciones.
      </p>
      {error && (
        <p role="alert" className="text-attention text-sm">
          {error}
        </p>
      )}

      {rec && (
        <>
          <section aria-labelledby="resumen-import">
            <h3 id="resumen-import" className="font-semibold">
              Vista previa
            </h3>
            <p className="text-muted mt-1 text-sm">
              {summary.filter((a) => a.qty > 0).length} posiciones abiertas · {summary.length} activos ·{" "}
              {operations.length} operaciones
            </p>
            <div className="relative mt-3 max-h-80 overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-muted bg-surface sticky top-0 text-left">
                  <tr>
                    <th className="py-1.5 font-medium">Activo</th>
                    <th className="py-1.5 font-medium">ISIN / símbolo</th>
                    <th className="py-1.5 text-right font-medium">Cantidad</th>
                    <th className="py-1.5 text-right font-medium">Operaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((a) => (
                    <tr key={a.key} className="border-border border-t">
                      <td className={`max-w-xs truncate py-1.5 ${a.qty ? "" : "text-muted"}`}>{a.name}</td>
                      <td className="text-muted py-1.5 text-xs">{a.isin ?? a.symbol}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {a.qty ? a.qty.toLocaleString("es-ES", { maximumFractionDigits: 4 }) : "cerrada"}
                      </td>
                      <td className="text-muted py-1.5 text-right tabular-nums">{a.ops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {rec.discrepancies.length > 0 && (
            <section aria-labelledby="diferencias" className="bg-surface-2 rounded-inner p-4 text-sm">
              <h3 id="diferencias" className="text-attention font-semibold">
                Diferencias con Investing
              </h3>
              <p className="text-muted mt-1">
                Mandan las operaciones del broker. Revisa estas posiciones en Investing si quieres que coincidan.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {rec.discrepancies.map((d) => (
                  <li key={d.assetKey}>
                    {d.name}: aquí {d.computed.toLocaleString("es-ES", { maximumFractionDigits: 4 })} · Investing{" "}
                    {d.investing.toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rec.doubtfulOrders.length > 0 && (
            <section aria-labelledby="dudosas" className="bg-surface-2 rounded-inner p-4 text-sm">
              <h3 id="dudosas" className="text-attention font-semibold">
                Órdenes de fondos dudosas
              </h3>
              <p className="text-muted mt-1">
                El archivo de MyInvestor no dice si fueron compras o ventas. Comprueba estas y cambia las que estén mal.
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {rec.doubtfulOrders.map((o) => {
                  const key = doubtKey(o);
                  const side = flipped.has(key) ? (o.side === "buy" ? "sell" : "buy") : o.side;
                  const name = rec.assets.find((a) => a.isin === o.isin)?.name ?? o.isin;
                  return (
                    <li key={key} className="flex flex-wrap items-center gap-3">
                      <span className="tabular-nums">{o.date}</span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="tabular-nums">
                        {o.units.toLocaleString("es-ES")} part. · {o.amountEur.toLocaleString("es-ES")} €
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFlipped((f) => {
                            const n = new Set(f);
                            if (n.has(key)) n.delete(key);
                            else n.add(key);
                            return n;
                          })
                        }
                        className={buttonClass.secondary}
                      >
                        {side === "buy" ? "Compra" : "Venta"} ⇄
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {rec.warnings.length > 0 && (
            <ul className="text-attention text-sm">
              {rec.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <div>
            <button
              type="button"
              onClick={save}
              disabled={pending || operations.length === 0}
              className={buttonClass.primary}
            >
              {pending ? "Guardando…" : `Guardar ${operations.length} operaciones`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div role={result.ok ? "status" : "alert"} className="bg-surface-2 rounded-inner px-4 py-3 text-sm">
          <p className={result.ok ? "text-finance font-semibold" : "text-attention"}>{result.message}</p>
          {result.ok && (
            <>
              <p>
                {result.newAssets} activos nuevos · {result.newOperations} operaciones nuevas (las que ya estaban no se
                duplican)
              </p>
              <Link href="/finanzas/inversiones" className="underline">
                Ver la cartera
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

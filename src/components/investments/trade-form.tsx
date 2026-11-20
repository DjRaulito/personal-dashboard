"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { recordTrade } from "@/app/(app)/inversiones/actions";
import { closeSheet } from "@/components/sheet";
import { buttonClass, Field, inputClass } from "@/components/ui";
import { matchAsset, OPERATION_LABELS, type BoardAsset, type BoardOperation } from "@/lib/investments/board";
import { KIND_LABELS } from "@/lib/investments/view";
import type { AssetKind } from "@/lib/investments/types";

export type TradeMode =
  | { kind: "new" }
  | { kind: "buy"; asset: BoardAsset }
  | { kind: "sell"; asset: BoardAsset }
  | { kind: "close"; asset: BoardAsset }
  | { kind: "operation"; asset: BoardAsset };

export const tradeTitle = (mode: TradeMode) =>
  mode.kind === "new"
    ? "Nueva compra"
    : mode.kind === "buy"
      ? `Comprar más · ${mode.asset.name}`
      : mode.kind === "sell"
        ? `Vender · ${mode.asset.name}`
        : mode.kind === "close"
          ? `Cerrar posición · ${mode.asset.name}`
          : `Añadir operación · ${mode.asset.name}`;

const qty = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 6 });
const money = (n: number, currency = "EUR") =>
  n.toLocaleString("es-ES", { style: "currency", currency: currency === "GBX" ? "GBP" : currency });
const toNumber = (s: string) => Number(s.replace(",", ".").trim());

interface NewAsset {
  name: string;
  isin: string;
  priceSymbol: string;
  kind: AssetKind;
  currency: string;
  priceSource: "yahoo" | "manual";
}

/** Formulario de compra, venta, cierre, dividendo o comisión (dentro de un Sheet). */
export function TradeForm({
  mode,
  assets,
  today,
  onDone,
}: {
  mode: TradeMode;
  /** Para buscar el activo en «Nueva compra». */
  assets: BoardAsset[];
  today: string;
  onDone: (assetId: string, message: string) => void;
}) {
  const [picked, setPicked] = useState<BoardAsset | null>(mode.kind === "new" ? null : mode.asset);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<NewAsset | null>(null);
  const [type, setType] = useState<BoardOperation["type"]>(
    mode.kind === "sell" || mode.kind === "close" ? "sell" : "buy",
  );
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(
    mode.kind === "close" && mode.asset.lastPrice != null ? String(mode.asset.lastPrice).replace(".", ",") : "",
  );
  const [fee, setFee] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const closing = mode.kind === "close";
  const currency = picked?.currency ?? creating?.currency ?? "EUR";
  const trade = type === "buy" || type === "sell";
  const matches = useMemo(() => assets.filter((a) => matchAsset(a, query)).slice(0, 6), [assets, query]);
  const units = closing ? (picked?.quantity ?? 0) : toNumber(quantity);
  const gross = units > 0 && toNumber(price) > 0 ? units * toNumber(price) : null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    start(async () => {
      const result = await recordTrade({
        assetId: picked?.id ?? null,
        newAsset: picked ? null : creating && { ...creating, isin: creating.isin || undefined },
        type,
        closeAll: closing,
        date,
        quantity: closing ? 0 : quantity || "0",
        price: trade ? price || null : null,
        amount: trade ? null : amount || null,
        fee: trade ? fee || "0" : "0",
      });
      if (!result.ok) return setError(result.message);
      onDone(result.assetId, result.message);
      closeSheet(form);
    });
  }

  // Paso 1 de «Nueva compra»: elegir o crear el activo
  if (!picked && !creating) {
    return (
      <div className="flex flex-col gap-3">
        <Field label="Busca el activo por nombre, ticker o ISIN">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="P. ej. Vanguard Global, VWCE o IE00B3RBWM25"
            className={inputClass}
          />
        </Field>
        {matches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {matches.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setPicked(a)}
                  className="hover:bg-surface-2 rounded-inner flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
                  <span className="text-muted text-xs">{a.isin ?? a.priceSymbol ?? KIND_LABELS[a.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length > 1 && (
          <button
            type="button"
            onClick={() => {
              const q = query.trim();
              const isIsin = /^[A-Z]{2}[A-Z0-9]{9}\d$/i.test(q);
              setCreating({
                name: isIsin ? "" : q,
                isin: isIsin ? q.toUpperCase() : "",
                priceSymbol: "",
                kind: "fund",
                currency: "EUR",
                priceSource: "yahoo",
              });
            }}
            className={clsx(buttonClass.secondary, "self-start")}
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Crear «{query.trim()}» como activo nuevo
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" autoComplete="off">
      {creating && !picked && (
        <fieldset className="border-border rounded-inner flex flex-col gap-3 border p-4">
          <legend className="text-muted px-1 text-sm">Activo nuevo</legend>
          <Field label="Nombre">
            <input
              value={creating.name}
              onChange={(e) => setCreating({ ...creating, name: e.target.value })}
              required
              maxLength={120}
              className={inputClass}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ISIN (opcional)">
              <input
                value={creating.isin}
                onChange={(e) => setCreating({ ...creating, isin: e.target.value })}
                maxLength={12}
                className={clsx(inputClass, "uppercase")}
              />
            </Field>
            <Field label="Ticker en Yahoo (opcional)">
              <input
                value={creating.priceSymbol}
                onChange={(e) => setCreating({ ...creating, priceSymbol: e.target.value })}
                maxLength={40}
                placeholder="VWCE.DE"
                className={inputClass}
              />
            </Field>
            <Field label="Tipo">
              <select
                value={creating.kind}
                onChange={(e) => setCreating({ ...creating, kind: e.target.value as AssetKind })}
                className={inputClass}
              >
                {Object.entries(KIND_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Moneda">
              <select
                value={creating.currency}
                onChange={(e) => setCreating({ ...creating, currency: e.target.value })}
                className={inputClass}
              >
                {["EUR", "USD", "GBP", "GBX", "CHF"].map((c) => (
                  <option key={c} value={c}>
                    {c === "GBX" ? "GBX (peniques)" : c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Precio">
            <select
              value={creating.priceSource}
              onChange={(e) => setCreating({ ...creating, priceSource: e.target.value as "yahoo" | "manual" })}
              className={inputClass}
            >
              <option value="yahoo">Automático (Yahoo Finance, por ticker o ISIN)</option>
              <option value="manual">A mano (planes de pensiones y sin cotización)</option>
            </select>
          </Field>
          <button
            type="button"
            onClick={() => setCreating(null)}
            className="text-muted hover:text-text self-start text-xs underline underline-offset-4"
          >
            Volver a buscar
          </button>
        </fieldset>
      )}

      {mode.kind === "operation" && (
        <div role="radiogroup" aria-label="Tipo de operación" className="flex flex-wrap gap-2">
          {(Object.keys(OPERATION_LABELS) as BoardOperation["type"][]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium",
                type === t ? "bg-selected text-on-selected" : "bg-surface-2 text-muted hover:text-text",
              )}
            >
              {OPERATION_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {closing && picked && (
        <p className="bg-surface-2 rounded-inner px-4 py-3 text-sm">
          Vendes las <strong className="tabular-nums">{qty(picked.quantity)}</strong> participaciones y la posición pasa
          a Cerradas con su resultado final.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fecha">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        {trade && !closing && (
          <Field
            label={type === "sell" && picked ? `Participaciones (tienes ${qty(picked.quantity)})` : "Participaciones"}
          >
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              required
              className={clsx(inputClass, "tabular-nums")}
            />
          </Field>
        )}
        {trade && (
          <Field label={`Precio por participación (${currency})`}>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              required
              className={clsx(inputClass, "tabular-nums")}
            />
          </Field>
        )}
        {trade && (
          <Field label="Comisión (€, opcional)">
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode="decimal"
              className={clsx(inputClass, "tabular-nums")}
            />
          </Field>
        )}
        {!trade && (
          <Field label="Importe (€)">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
              className={clsx(inputClass, "tabular-nums")}
            />
          </Field>
        )}
      </div>

      {trade && gross != null && (
        <p className="text-muted text-sm tabular-nums">
          Importe: {money(gross, currency)}
          {currency !== "EUR" && " (se pasa a euros con el cambio de ese día)"}
        </p>
      )}
      {error && (
        <p role="alert" className="text-attention text-sm">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={clsx(buttonClass.primary, "self-start")}>
        {pending
          ? "Guardando…"
          : closing
            ? "Cerrar posición"
            : type === "sell"
              ? "Guardar venta"
              : type === "buy"
                ? "Guardar compra"
                : `Guardar ${OPERATION_LABELS[type].toLowerCase()}`}
      </button>
    </form>
  );
}

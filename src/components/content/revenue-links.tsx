"use client";

import { useState, useTransition } from "react";
import { linkTransaction, unlinkTransaction } from "@/app/(app)/contenido/actions";
import { buttonClass, inputClass } from "@/components/ui";
import { formatCents } from "@/lib/finance/money";

export interface TxItem {
  id: string;
  booked_on: string;
  description: string;
  amount_cents: number;
}

const date = (d: string) => d.split("-").reverse().join("/");

/** Ingresos de Finanzas atribuidos a la pieza: listar, enlazar y quitar. */
export function RevenueLinks({
  pieceId,
  linked,
  candidates,
}: {
  pieceId: string;
  linked: TxItem[];
  candidates: TxItem[];
}) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState(false);
  const linkedIds = new Set(linked.map((t) => t.id));
  const available = candidates.filter((t) => !linkedIds.has(t.id));
  const total = linked.reduce((s, t) => s + t.amount_cents, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-3xl font-extrabold tracking-tight tabular-nums">{formatCents(total)}</p>
      {linked.length > 0 && (
        <ul className="divide-border divide-y text-sm">
          {linked.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2">
              <span className="text-muted shrink-0 pr-1 tabular-nums">{date(t.booked_on)}</span>
              <span className="min-w-0 flex-1 truncate">{t.description}</span>
              <span className="tabular-nums">{formatCents(t.amount_cents)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => unlinkTransaction(pieceId, t.id))}
                aria-label={`Quitar «${t.description}»`}
                className="text-muted hover:text-expense focus-visible:outline-content rounded-full px-2 focus-visible:outline-2"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 ? (
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`tx-${pieceId}`}>
            Ingreso para enlazar
          </label>
          <select
            id={`tx-${pieceId}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={inputClass}
          >
            <option value="">Elige un ingreso reciente…</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {date(t.booked_on)} · {t.description} · {formatCents(t.amount_cents)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={() =>
              start(async () => {
                const result = await linkTransaction(pieceId, selected);
                setError(!result.ok);
                if (result.ok) setSelected("");
              })
            }
            className={buttonClass.secondary}
          >
            Enlazar
          </button>
        </div>
      ) : (
        <p className="text-muted text-sm">No hay ingresos recientes en Finanzas para enlazar.</p>
      )}
      {error && (
        <p role="alert" className="text-attention text-sm">
          No se pudo enlazar el ingreso.
        </p>
      )}
    </div>
  );
}

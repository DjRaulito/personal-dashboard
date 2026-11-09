"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { deleteTransactions, setTransactionsCategory } from "@/app/(app)/finanzas/actions";
import { buttonClass, inputClass } from "@/components/ui";
import type { categoryOptions } from "@/lib/finance/categories";
import { formatCents } from "@/lib/finance/money";
import { suggestPattern } from "@/lib/finance/rules";
import { CategoryOptions } from "./category-select";
import { TransactionForm, type TransactionFormValues } from "./transaction-form";

export interface TableRow extends TransactionFormValues {
  accountName: string;
  currency: string;
  categoryLabel: string | null;
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function TransactionsTable({
  rows,
  accounts,
  categoryGroups,
  today,
}: {
  rows: TableRow[];
  accounts: { id: string; name: string }[];
  categoryGroups: ReturnType<typeof categoryOptions>;
  today: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ids = [...selected];
  const runBulk = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      setSelected(new Set());
    });

  return (
    <div>
      <div
        className={clsx(
          "bg-surface-2 rounded-inner mb-3 flex-wrap items-center gap-2 px-3 py-2",
          ids.length === 0 ? "hidden" : "flex",
        )}
      >
        <span className="text-sm font-medium">{ids.length} seleccionados</span>
        <select
          aria-label="Categoría para los seleccionados"
          value={bulkCategory}
          onChange={(e) => setBulkCategory(e.target.value)}
          className={`${inputClass} w-auto max-w-64 py-1.5`}
        >
          <option value="">Elegir categoría…</option>
          <option value="none">Quitar categoría</option>
          <CategoryOptions groups={categoryGroups} />
        </select>
        <button
          type="button"
          disabled={pending || !bulkCategory}
          className={buttonClass.secondary}
          onClick={() => runBulk(() => setTransactionsCategory(ids, bulkCategory === "none" ? null : bulkCategory))}
        >
          Aplicar
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass.danger}
          onClick={() => {
            if (confirm(`¿Borrar ${ids.length} movimientos?`)) runBulk(() => deleteTransactions(ids));
          }}
        >
          Borrar
        </button>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="accent-finance h-4 w-4"
                />
              </th>
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Concepto</th>
              <th className="py-2 font-medium">Categoría</th>
              <th className="py-2 text-right font-medium">Importe</th>
              <th className="py-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onToggle={() => toggle(r.id)}
                editing={editing === r.id}
                onEdit={() => setEditing(editing === r.id ? null : r.id)}
                editor={
                  <TransactionForm
                    accounts={accounts}
                    categoryGroups={categoryGroups}
                    transaction={r}
                    today={today}
                    onDone={() => setEditing(null)}
                  />
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  selected,
  onToggle,
  editing,
  onEdit,
  editor,
}: {
  row: TableRow;
  selected: boolean;
  onToggle: () => void;
  editing: boolean;
  onEdit: () => void;
  editor: React.ReactNode;
}) {
  const ruleHref = `/finanzas/categorias?patron=${encodeURIComponent(suggestPattern(row.description))}${
    row.category_id ? `&categoria=${row.category_id}` : ""
  }#nueva-regla`;
  return (
    <>
      <tr className={clsx("border-border border-t", selected && "bg-surface-2/60")}>
        <td className="py-2.5">
          <input
            type="checkbox"
            aria-label={`Seleccionar ${row.description}`}
            checked={selected}
            onChange={onToggle}
            className="accent-finance h-4 w-4"
          />
        </td>
        <td className="text-muted py-2.5 whitespace-nowrap tabular-nums">
          {dateFmt.format(new Date(`${row.booked_on}T00:00:00Z`))}
        </td>
        <td className="max-w-xs py-2.5">
          <span className="block truncate" title={row.description}>
            {row.description}
          </span>
          <span className="text-muted block truncate text-xs">{row.accountName}</span>
        </td>
        <td className="py-2.5">
          {row.categoryLabel ? (
            <span className="bg-surface-2 rounded-full px-2.5 py-1 text-xs">{row.categoryLabel}</span>
          ) : (
            <span className="text-attention text-xs">Sin categoría</span>
          )}
        </td>
        <td className="py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
          <span className={row.amount_cents > 0 ? "text-finance" : undefined}>
            {formatCents(row.amount_cents, row.currency, { signed: row.amount_cents > 0 })}
          </span>
        </td>
        <td className="py-2.5 pl-2 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onEdit}
            className="text-muted hover:text-text px-2 text-xs underline-offset-2 hover:underline"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
          <Link href={ruleHref} className="text-muted hover:text-text px-2 text-xs underline-offset-2 hover:underline">
            Crear regla
          </Link>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="pb-4">
            <div className="bg-surface-2 rounded-inner p-4">{editor}</div>
          </td>
        </tr>
      )}
    </>
  );
}

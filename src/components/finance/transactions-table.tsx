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
const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

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

  const [anchor, setAnchor] = useState<number | null>(null);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  // Clic: alterna la fila. Mayúsculas + clic: selecciona el tramo desde la última fila tocada
  const select = (index: number, range: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor !== null) {
        const [a, b] = anchor < index ? [anchor, index] : [index, anchor];
        for (let i = a; i <= b; i++) next.add(rows[i].id);
      } else if (next.has(rows[index].id)) next.delete(rows[index].id);
      else next.add(rows[index].id);
      return next;
    });
    setAnchor(index);
  };

  const ids = [...selected];
  const clear = () => {
    setSelected(new Set());
    setAnchor(null);
  };
  const runBulk = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      clear();
    });

  return (
    <div>
      <div className="bg-surface-2 rounded-inner mb-3 flex min-h-11 flex-wrap items-center gap-2 px-3 py-1.5">
        {ids.length === 0 ? (
          <>
            <span className="text-muted text-sm">
              Toca una fila para seleccionarla<span className="hidden sm:inline"> · Mayús + clic para un tramo</span>
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set(rows.map((r) => r.id)))}
              className="text-muted hover:text-text ml-auto px-2 text-sm underline-offset-2 hover:underline"
            >
              Seleccionar todos
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium tabular-nums" aria-live="polite">
              {ids.length} {ids.length === 1 ? "seleccionado" : "seleccionados"}
            </span>
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
            <span className="ml-auto flex gap-1">
              {!allSelected && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set(rows.map((r) => r.id)))}
                  className="text-muted hover:text-text px-2 text-sm underline-offset-2 hover:underline"
                >
                  Todos
                </button>
              )}
              <button
                type="button"
                onClick={clear}
                className="text-muted hover:text-text px-2 text-sm underline-offset-2 hover:underline"
              >
                Quitar selección
              </button>
            </span>
          </>
        )}
      </div>

      <div className="relative overflow-x-auto">
        <table role="grid" aria-multiselectable="true" className="w-full text-sm sm:min-w-[600px]">
          <thead className="text-muted text-left">
            <tr>
              <th className="hidden py-2 pl-3 font-medium sm:table-cell">Fecha</th>
              <th className="py-2 pl-3 font-medium sm:pl-0">Concepto</th>
              <th className="hidden py-2 font-medium sm:table-cell">Categoría</th>
              <th className="py-2 text-right font-medium">Importe</th>
              <th className="py-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Row
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onSelect={(range) => select(i, range)}
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

// Los clics en botones y enlaces de la fila no la seleccionan
const isControl = (target: EventTarget) =>
  target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, label"));

function Row({
  row,
  selected,
  onSelect,
  editing,
  onEdit,
  editor,
}: {
  row: TableRow;
  selected: boolean;
  onSelect: (range: boolean) => void;
  editing: boolean;
  onEdit: () => void;
  editor: React.ReactNode;
}) {
  const ruleHref = `/ajustes/finanzas/categorias?patron=${encodeURIComponent(suggestPattern(row.description))}${
    row.category_id ? `&categoria=${row.category_id}` : ""
  }#nueva-regla`;
  return (
    <>
      <tr
        aria-selected={selected}
        tabIndex={0}
        onClick={(e) => {
          if (!isControl(e.target)) onSelect(e.shiftKey);
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
            e.preventDefault();
            onSelect(e.shiftKey);
          }
        }}
        className={clsx(
          "border-border focus-visible:outline-content cursor-pointer border-t transition-colors duration-100 select-none focus-visible:outline-2 focus-visible:-outline-offset-2",
          selected ? "bg-finance/12 shadow-[inset_3px_0_0_var(--color-finance)]" : "hover:bg-surface-2/60",
        )}
      >
        <td className="text-muted hidden py-2.5 pl-3 whitespace-nowrap tabular-nums sm:table-cell">
          {dateFmt.format(new Date(`${row.booked_on}T00:00:00Z`))}
        </td>
        <td className="max-w-0 py-2.5 pl-3 sm:max-w-xs sm:pl-0">
          <span className="block truncate" title={row.description}>
            {row.description}
          </span>
          {/* En el móvil la fecha y la categoría van aquí debajo */}
          <span className="text-muted block truncate text-xs">
            <span className="tabular-nums sm:hidden">
              {shortDate.format(new Date(`${row.booked_on}T00:00:00Z`))} ·{" "}
            </span>
            <span className="sm:hidden">{row.categoryLabel ?? "Sin categoría"} · </span>
            {row.accountName}
          </span>
        </td>
        <td className="hidden py-2.5 sm:table-cell">
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
          <Link
            href={ruleHref}
            className="text-muted hover:text-text hidden px-2 text-xs underline-offset-2 hover:underline sm:inline"
          >
            Crear regla
          </Link>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="pb-4">
            <div className="bg-surface-2 rounded-inner p-4">{editor}</div>
          </td>
        </tr>
      )}
    </>
  );
}

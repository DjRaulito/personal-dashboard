"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { inputClass } from "@/components/ui";
import type { categoryOptions } from "@/lib/finance/categories";
import { filtersHref, type TransactionFilters as Filters } from "@/lib/finance/filters";
import { CategoryOptions } from "./category-select";

const selectClass = `${inputClass} w-auto min-w-0 py-2`;

/**
 * Filtros de la tabla de movimientos. Se aplican al cambiarlos (la búsqueda con un respiro)
 * y viven en la URL, así se conservan al cambiar de mes o de página.
 */
export function TransactionFilters({
  filters,
  accounts,
  categoryGroups,
}: {
  filters: Filters;
  accounts: { id: string; name: string }[];
  categoryGroups: ReturnType<typeof categoryOptions>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (changes: Partial<Filters>) =>
    startTransition(() =>
      router.replace(filtersHref(pathname, filters, { ...changes, pagina: undefined }), { scroll: false }),
    );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onSearch = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: value.trim() || undefined }), 350);
  };

  const active = Boolean(filters.q || filters.categoria || filters.cuenta || filters.tipo);

  return (
    <div
      role="search"
      aria-label="Filtrar movimientos"
      aria-busy={pending}
      className={clsx("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-70")}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar concepto…"
        aria-label="Buscar concepto"
        autoComplete="off"
        className={`${inputClass} min-w-40 flex-1 py-2`}
      />
      <select
        aria-label="Categoría"
        value={filters.categoria ?? ""}
        onChange={(e) => apply({ categoria: (e.target.value || undefined) as Filters["categoria"] })}
        className={selectClass}
      >
        <option value="">Todas las categorías</option>
        <option value="sin">Sin categoría</option>
        <CategoryOptions groups={categoryGroups} />
      </select>
      <select
        aria-label="Tipo"
        value={filters.tipo ?? ""}
        onChange={(e) => apply({ tipo: (e.target.value || undefined) as Filters["tipo"] })}
        className={selectClass}
      >
        <option value="">Gastos e ingresos</option>
        <option value="gastos">Solo gastos</option>
        <option value="ingresos">Solo ingresos</option>
      </select>
      {accounts.length > 1 && (
        <select
          aria-label="Cuenta"
          value={filters.cuenta ?? ""}
          onChange={(e) => apply({ cuenta: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            apply({ q: undefined, categoria: undefined, cuenta: undefined, tipo: undefined });
          }}
          className="text-muted hover:text-text px-2 text-sm underline-offset-2 hover:underline"
        >
          Quitar filtros
        </button>
      )}
    </div>
  );
}

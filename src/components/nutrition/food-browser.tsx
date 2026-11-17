"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, LayoutList, Rows3 } from "lucide-react";
import { FoodActions } from "@/components/nutrition/forms";
import { EmptyState, inputClass } from "@/components/ui";
import {
  dominantMacro,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  type Food,
  type FoodCategory,
} from "@/lib/nutrition/portions";

type MacroKey = "protein_g" | "carbs_g" | "fat_g";
type SortKey = "name" | "kcal" | MacroKey;

const MACROS: { key: MacroKey; label: string; short: string }[] = [
  { key: "protein_g", label: "Proteína", short: "P" },
  { key: "carbs_g", label: "Hidratos", short: "HC" },
  { key: "fat_g", label: "Grasa", short: "G" },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "kcal", label: "Menos kcal" },
  { key: "protein_g", label: "Más proteína" },
  { key: "carbs_g", label: "Más hidratos" },
  { key: "fat_g", label: "Más grasa" },
];

const num = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pill = (active: boolean) =>
  clsx(
    "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
    active ? "bg-nutrition text-ink" : "bg-surface-2 text-muted hover:text-text",
  );
const COLS = "grid grid-cols-[minmax(0,1fr)_3rem_2.75rem_2.75rem_2.75rem_1.25rem] items-center gap-x-2";

function FoodRow({
  food,
  byId,
  rawFoods,
}: {
  food: Food;
  byId: Map<string, Food>;
  rawFoods: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const top = dominantMacro(food);
  const details = [
    food.unit_label && food.unit_grams ? `1 ${food.unit_label} = ${num(food.unit_grams)} g` : null,
    food.cooked_from && food.cooked_factor
      ? `Cocido de ${byId.get(food.cooked_from)?.name ?? "?"} (×${num(food.cooked_factor)})`
      : null,
    food.price_cents_per_kg !== null && food.price_cents_per_kg !== undefined
      ? `${(food.price_cents_per_kg / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}/kg${food.price_source === "ai" ? " (estimado)" : ""}`
      : null,
  ].filter(Boolean);
  return (
    <li className="border-border border-t">
      <button
        type="button"
        aria-expanded={open}
        className={`${COLS} hover:bg-surface-2 w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 sm:px-6`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate font-medium">{food.name}</span>
        <span className="text-right tabular-nums">{num(food.kcal)}</span>
        {MACROS.map((m) => (
          <span
            key={m.key}
            className={clsx("text-right tabular-nums", top === m.key ? "text-nutrition font-semibold" : "text-muted")}
          >
            {num(food[m.key])}
          </span>
        ))}
        <ChevronDown
          aria-hidden="true"
          className={clsx("text-muted h-4 w-4 transition-transform duration-150", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 sm:px-6">
          <p className="text-muted min-w-0 flex-1 text-xs">
            {[FOOD_CATEGORY_LABELS[food.category ?? "other"], ...details].join(" · ")}
          </p>
          <FoodActions food={food} rawFoods={rawFoods} />
        </div>
      )}
    </li>
  );
}

/** Lista de alimentos: macros por 100 g de un vistazo, con filtros y vista en lista o por apartados. */
export function FoodBrowser({ foods }: { foods: Food[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [macro, setMacro] = useState<MacroKey | null>(null);
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"list" | "sections">("sections");
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const rawFoods = useMemo(() => foods.filter((f) => !f.cooked_from).map((f) => ({ id: f.id, name: f.name })), [foods]);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    const list = foods.filter(
      (f) =>
        (!q || norm(f.name).includes(q)) &&
        (!category || (f.category ?? "other") === category) &&
        (!macro || dominantMacro(f) === macro),
    );
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "es")
        : sort === "kcal"
          ? a.kcal - b.kcal
          : b[sort] - a[sort] || a.name.localeCompare(b.name, "es"),
    );
  }, [foods, query, category, macro, sort]);

  const sections =
    view === "sections"
      ? FOOD_CATEGORIES.map((c) => ({
          key: c,
          label: FOOD_CATEGORY_LABELS[c],
          foods: shown.filter((f) => (f.category ?? "other") === c),
        })).filter((s) => s.foods.length > 0)
      : [{ key: "all", label: null, foods: shown }];

  return (
    <section className="rounded-tile border-border bg-surface border">
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="food-search">
            Buscar alimento
          </label>
          <input
            id="food-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre ${foods.length} alimentos…`}
            className={`${inputClass} min-w-0 flex-1 basis-48`}
          />
          <label className="sr-only" htmlFor="food-sort">
            Ordenar por
          </label>
          <select
            id="food-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={`${inputClass.replace("w-full", "")} shrink-0`}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Vista" className="bg-surface-2 flex shrink-0 rounded-full p-1">
            {(
              [
                ["sections", "Por apartados", Rows3],
                ["list", "Lista", LayoutList],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                aria-label={label}
                title={label}
                className={clsx(
                  "rounded-full p-2 transition-colors duration-150",
                  view === value ? "bg-nutrition text-ink" : "text-muted hover:text-text",
                )}
                onClick={() => setView(value)}
              >
                <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
        <div
          role="group"
          aria-label="Macro principal"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <button type="button" aria-pressed={!macro} className={pill(!macro)} onClick={() => setMacro(null)}>
            Todos los macros
          </button>
          {MACROS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={macro === m.key}
              className={pill(macro === m.key)}
              onClick={() => setMacro(macro === m.key ? null : m.key)}
            >
              Sobre todo {m.label.toLowerCase()}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Apartado"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <button type="button" aria-pressed={!category} className={pill(!category)} onClick={() => setCategory(null)}>
            Todos
          </button>
          {FOOD_CATEGORIES.filter((c) => foods.some((f) => (f.category ?? "other") === c)).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={pill(category === c)}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {FOOD_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className={`${COLS} text-muted px-4 pb-2 text-xs sm:px-6`}>
        <span>Por 100 g</span>
        <span className="text-right">kcal</span>
        {MACROS.map((m) => (
          <abbr key={m.key} title={m.label} className="text-right no-underline">
            {m.short}
          </abbr>
        ))}
        <span />
      </div>
      {shown.length === 0 ? (
        <div className="border-border border-t px-6">
          <EmptyState>Ningún alimento con esos filtros.</EmptyState>
        </div>
      ) : (
        sections.map((s) => (
          <div key={s.key}>
            {s.label && (
              <h3 className="bg-surface-2 border-border text-muted border-t px-4 py-1.5 text-xs font-semibold tracking-wide uppercase sm:px-6">
                {s.label} · {s.foods.length}
              </h3>
            )}
            <ul>
              {s.foods.map((f) => (
                <FoodRow key={f.id} food={f} byId={byId} rawFoods={rawFoods} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

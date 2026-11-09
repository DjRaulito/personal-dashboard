import type { Metadata } from "next";
import {
  ApplyRulesButton,
  CategoryItem,
  DeleteRuleButton,
  NewCategoryForm,
} from "@/components/finance/category-manager";
import { RuleForm } from "@/components/finance/rule-form";
import { Tile, TileTitle } from "@/components/ui";
import {
  buildCategoryTree,
  categoryLabels,
  categoryOptions,
  KIND_LABELS,
  type CategoryKind,
} from "@/lib/finance/categories";
import { getCategories } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categorías y reglas · Finanzas" };

const MATCH_LABELS: Record<string, string> = {
  contains: "contiene",
  starts_with: "empieza por",
  equals: "es exactamente",
};
const SIGN_LABELS: Record<string, string> = { any: "", expense: " (gastos)", income: " (ingresos)" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ patron?: string; categoria?: string }>;
}) {
  const { patron, categoria } = await searchParams;
  const supabase = await createClient();
  const [categories, { data: rules }, { count: uncategorized }] = await Promise.all([
    getCategories(),
    supabase
      .from("rules")
      .select("id, pattern, match_type, amount_sign, category_id, priority")
      .order("priority")
      .order("pattern"),
    supabase.from("transactions").select("id", { count: "exact", head: true }).is("category_id", null),
  ]);
  const tree = buildCategoryTree(categories);
  const labels = categoryLabels(categories);
  const groups = categoryOptions(categories);

  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      <div className="flex flex-col gap-3.5">
        <Tile>
          <span id="nueva-regla" />
          <TileTitle dot="bg-attention">Nueva regla</TileTitle>
          <p className="text-muted mt-2 text-sm">
            Las reglas categorizan solas los movimientos al importarlos. No distinguen tildes ni mayúsculas.
          </p>
          <div className="mt-4">
            <RuleForm
              key={`${patron}-${categoria}`}
              categoryGroups={groups}
              defaultPattern={patron}
              defaultCategory={categoria}
            />
          </div>
        </Tile>

        <Tile>
          <TileTitle dot="bg-attention">Reglas ({rules?.length ?? 0})</TileTitle>
          <div className="mt-4">
            <ApplyRulesButton uncategorized={uncategorized ?? 0} />
          </div>
          <ul className="mt-4 flex flex-col">
            {(rules ?? []).map((r) => (
              <li key={r.id} className="border-border flex items-center gap-3 border-t py-2 text-sm">
                <span className="text-muted w-8 shrink-0 text-xs tabular-nums">{r.priority}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-muted">{MATCH_LABELS[r.match_type]} </span>
                  <span className="font-medium">“{r.pattern}”</span>
                  <span className="text-muted">{SIGN_LABELS[r.amount_sign]} → </span>
                  {labels.get(r.category_id) ?? "—"}
                </span>
                <DeleteRuleButton id={r.id} pattern={r.pattern} />
              </li>
            ))}
          </ul>
        </Tile>
      </div>

      <div className="flex flex-col gap-3.5">
        <Tile>
          <TileTitle>Nueva categoría</TileTitle>
          <div className="mt-4">
            <NewCategoryForm roots={tree} />
          </div>
        </Tile>
        <Tile>
          <TileTitle>Categorías</TileTitle>
          {(Object.keys(KIND_LABELS) as CategoryKind[]).map((kind) => (
            <section key={kind} className="mt-5">
              <h3 className="text-muted text-sm font-medium">{KIND_LABELS[kind]}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {tree
                  .filter((n) => n.kind === kind)
                  .map((n) => (
                    <li key={n.id} className="bg-surface-2 rounded-inner px-4 py-3 text-sm">
                      <CategoryItem id={n.id} name={n.name} isRoot />
                      {n.children.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5 pl-4">
                          {n.children.map((c) => (
                            <li key={c.id}>
                              <CategoryItem id={c.id} name={c.name} isRoot={false} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </Tile>
      </div>
    </div>
  );
}

export type CategoryKind = "expense" | "income" | "transfer";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
}

export interface CategoryNode extends Category {
  children: Category[];
}

export const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Gastos",
  income: "Ingresos",
  transfer: "Transferencias",
};

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "es");

/** Árbol de categorías (principal -> subcategorías), ordenado por nombre. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const roots = categories.filter((c) => !c.parent_id).sort(byName);
  return roots.map((root) => ({
    ...root,
    children: categories.filter((c) => c.parent_id === root.id).sort(byName),
  }));
}

/** Etiqueta legible: "Alimentación › Supermercado". */
export function categoryLabels(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return new Map(
    categories.map((c) => {
      const parent = c.parent_id ? byId.get(c.parent_id) : null;
      return [c.id, parent ? `${parent.name} › ${c.name}` : c.name];
    }),
  );
}

/** Opciones para un <select>, agrupadas por tipo y en orden de árbol. */
export function categoryOptions(categories: Category[]) {
  const tree = buildCategoryTree(categories);
  return (Object.keys(KIND_LABELS) as CategoryKind[]).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    options: tree
      .filter((n) => n.kind === kind)
      .flatMap((n) => [
        { id: n.id, label: n.name },
        ...n.children.map((c) => ({ id: c.id, label: `${n.name} › ${c.name}` })),
      ]),
  }));
}

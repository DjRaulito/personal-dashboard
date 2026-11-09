import { describe, expect, it } from "vitest";
import { buildCategoryTree, categoryLabels, categoryOptions, type Category } from "./categories";

const cats: Category[] = [
  { id: "a", name: "Alimentación", kind: "expense", parent_id: null },
  { id: "s", name: "Supermercado", kind: "expense", parent_id: "a" },
  { id: "c", name: "Cafés y bares", kind: "expense", parent_id: "a" },
  { id: "n", name: "Nómina", kind: "income", parent_id: null },
];

describe("categorías", () => {
  it("árbol ordenado", () => {
    const tree = buildCategoryTree(cats);
    expect(tree.map((n) => n.name)).toEqual(["Alimentación", "Nómina"]);
    expect(tree[0].children.map((c) => c.name)).toEqual(["Cafés y bares", "Supermercado"]);
  });

  it("etiquetas con la categoría padre", () => {
    expect(categoryLabels(cats).get("s")).toBe("Alimentación › Supermercado");
    expect(categoryLabels(cats).get("n")).toBe("Nómina");
  });

  it("opciones agrupadas por tipo", () => {
    const groups = categoryOptions(cats);
    expect(groups.map((g) => g.options.length)).toEqual([3, 1, 0]);
  });
});

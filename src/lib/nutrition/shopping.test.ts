import { describe, expect, it } from "vitest";
import type { Food, PlanGroup } from "./portions";
import { formatWeight, groupDays, weeklyShopping } from "./shopping";

const food = (id: string, extra: Partial<Food> = {}): Food => ({
  id,
  name: id,
  kcal: 100,
  protein_g: 10,
  carbs_g: 10,
  fat_g: 1,
  unit_label: null,
  unit_grams: null,
  ...extra,
});

const foods = new Map(
  [
    food("arroz", { price_cents_per_kg: 150 }),
    food("pasta"),
    food("huevo", { unit_label: "huevo", unit_grams: 60, price_cents_per_kg: 400 }),
  ].map((f) => [f.id, f]),
);

const carbs = (id: string, grams: number): PlanGroup => ({
  id,
  name: "Hidratos",
  kind: "carbs",
  options: [
    { id: `${id}-arroz`, food_id: "arroz", amount: grams, unit: "g" },
    { id: `${id}-pasta`, food_id: "pasta", amount: grams, unit: "g" },
  ],
});
const protein: PlanGroup = {
  id: "p",
  name: "Proteína",
  kind: "protein",
  options: [{ id: "p-huevo", food_id: "huevo", amount: 2, unit: "ud" }],
};
const meals = [
  { id: "comida", name: "Comida", groups: [carbs("c", 150), protein] },
  { id: "cena", name: "Cena", groups: [carbs("n", 125)] },
];

describe("lista de la compra", () => {
  it("suma por alimento las raciones de la semana y calcula el gasto", () => {
    const picks = new Map([
      ["c-arroz", 4],
      ["c-pasta", 3],
      ["n-arroz", 2],
      ["p-huevo", 7],
    ]);
    const { lines, totalCents, unpriced } = weeklyShopping(meals, picks, foods);
    const byFood = new Map(lines.map((l) => [l.food.id, l]));
    expect(byFood.get("arroz")).toMatchObject({
      grams: 850,
      cents: 128,
      uses: [
        { meal: "Comida", days: 4 },
        { meal: "Cena", days: 2 },
      ],
    });
    expect(byFood.get("huevo")).toMatchObject({ grams: 840, units: 14, cents: 336 });
    expect(byFood.get("pasta")).toMatchObject({ grams: 450, cents: null });
    expect(totalCents).toBe(464);
    expect(unpriced).toBe(1);
    // Primero lo más caro; lo que no tiene precio, al final
    expect(lines.map((l) => l.food.id)).toEqual(["huevo", "arroz", "pasta"]);
    expect(groupDays(meals[0].groups[0], picks)).toBe(7);
  });

  it("formatea pesos", () => {
    expect(formatWeight(850)).toBe("850 g");
    expect(formatWeight(1250)).toBe("1,25 kg");
  });
});

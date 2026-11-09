import { describe, expect, it } from "vitest";
import {
  groupPortionTotals,
  groupProgress,
  groupTarget,
  optionGrams,
  portionOf,
  roundGrams,
  splitRemaining,
  totalsOf,
  type Food,
  type PlanGroup,
} from "./portions";

const food = (id: string, kcal: number, p: number, c: number, f: number, unit?: [string, number]): Food => ({
  id,
  name: id,
  kcal,
  protein_g: p,
  carbs_g: c,
  fat_g: f,
  unit_label: unit?.[0] ?? null,
  unit_grams: unit?.[1] ?? null,
});

const foods = new Map(
  [
    food("tortitas", 387, 8, 81, 3),
    food("crema-arroz", 370, 7, 82, 1),
    food("avena", 370, 13, 60, 7),
    food("arroz-cocido", 130, 2.7, 28, 0.3),
    food("arroz", 355, 7, 78, 0.9),
    { ...food("arroz-cocido-plan", 142, 2.8, 31.2, 0.4), cooked_from: "arroz", cooked_factor: 2.5 },
    food("pasta", 360, 12, 72, 1.5),
    { ...food("pasta-cocida", 180, 6, 36, 0.8), cooked_from: "pasta", cooked_factor: 2 },
    food("huevo", 143, 12.6, 0.7, 9.5, ["huevo", 60]),
    food("queso-batido", 46, 8, 3.5, 0.2),
    food("platano", 89, 1.1, 23, 0.3, ["plátano", 120]),
  ].map((f) => [f.id, f]),
);

const carbs: PlanGroup = {
  id: "hc",
  name: "Hidratos",
  kind: "carbs",
  options: [
    { id: "o1", food_id: "tortitas", amount: 125, unit: "g" },
    { id: "o2", food_id: "crema-arroz", amount: 125, unit: "g" },
    { id: "o3", food_id: "avena", amount: 125, unit: "g" },
  ],
};

const protein: PlanGroup = {
  id: "prote",
  name: "Proteína",
  kind: "protein",
  options: [
    { id: "p1", food_id: "huevo", amount: 2, unit: "ud" },
    { id: "p2", food_id: "queso-batido", amount: 250, unit: "g" },
  ],
};

describe("raciones", () => {
  it("pasa unidades a gramos", () => {
    expect(optionGrams(protein.options[0], foods.get("huevo"))).toBe(120);
    expect(optionGrams(carbs.options[0], foods.get("tortitas"))).toBe(125);
  });

  it("calcula el objetivo del grupo con la mediana de sus opciones", () => {
    // tortitas 101,25 g HC · crema 102,5 · avena 75 → mediana 101,25
    expect(groupTarget(carbs, foods)).toBeCloseTo(101.25);
  });

  it("usa la equivalencia de la lista si el alimento está en ella", () => {
    expect(portionOf("tortitas", 60, carbs, foods)).toBeCloseTo(0.48);
    expect(portionOf("huevo", 60, protein, foods)).toBeCloseTo(0.5);
  });

  it("compara por el macro principal si el alimento no está en la lista", () => {
    // 125 g de arroz cocido = 35 g de HC → 35 / 101,25 ≈ 0,346 raciones
    expect(portionOf("arroz-cocido", 125, carbs, foods)).toBeCloseTo(35 / 101.25);
  });

  it("dice cuánto falta de cada opción (el ejemplo de las tortitas y el arroz)", () => {
    const p = groupProgress(
      carbs,
      [
        { id: "l1", food_id: "tortitas", grams: 60, group_id: "hc" },
        { id: "l2", food_id: "arroz-cocido", grams: 125, group_id: "hc" },
        { id: "l3", food_id: "avena", grams: 50, group_id: "otro-grupo" },
      ],
      foods,
    );
    expect(p.eaten).toBeCloseTo(0.48 + 35 / 101.25);
    expect(p.remaining).toBeCloseTo(1 - 0.48 - 35 / 101.25);
    // Faltan ~0,174 raciones → ~22 g de tortitas
    expect(p.options.map((o) => o.grams)).toEqual([22, 22, 22]);
    expect(p.logs).toHaveLength(2);
  });

  it("no pide más cuando ya se ha completado y cuenta unidades", () => {
    const done = groupProgress(protein, [{ id: "l", food_id: "queso-batido", grams: 300, group_id: "prote" }], foods);
    expect(done.remaining).toBe(0);
    expect(done.eaten).toBeCloseTo(1.2);
    const half = groupProgress(protein, [{ id: "l", food_id: "huevo", grams: 60, group_id: "prote" }], foods);
    expect(half.options[0]).toMatchObject({ grams: 60, units: 1 });
    expect(half.options[1].grams).toBe(125);
  });

  it("los pesos del plan son en crudo: arroz cocido ÷ 2,5 y pasta cocida ÷ 2", () => {
    const comida: PlanGroup = {
      id: "hc-comida",
      name: "Hidratos",
      kind: "carbs",
      options: [
        { id: "a", food_id: "arroz", amount: 150, unit: "g" },
        { id: "b", food_id: "pasta", amount: 150, unit: "g" },
      ],
    };
    // 125 g de arroz cocido = 50 g de arroz crudo = 1/3 de ración
    expect(portionOf("arroz-cocido-plan", 125, comida, foods)).toBeCloseTo(50 / 150);
    // 150 g de pasta cocida = 75 g de pasta cruda = media ración
    expect(portionOf("pasta-cocida", 150, comida, foods)).toBeCloseTo(0.5);
    const p = groupProgress(
      comida,
      [{ id: "l", food_id: "arroz-cocido-plan", grams: 125, group_id: "hc-comida" }],
      foods,
    );
    // Faltan 100 g de arroz crudo ≈ 250 g cocido; 100 g de pasta ≈ 200 g cocida
    expect(p.options[0].grams).toBe(100);
    expect(p.options[0].cooked.map((c) => [c.food.id, c.grams])).toEqual([["arroz-cocido-plan", 250]]);
    expect(p.options[1].cooked.map((c) => [c.food.id, c.grams])).toEqual([["pasta-cocida", 200]]);
  });

  it("la verdura es libre", () => {
    const veg: PlanGroup = { id: "v", name: "Verdura", kind: "veg", options: [] };
    expect(groupProgress(veg, [], foods).remaining).toBe(0);
  });

  it("reparte lo que falta entre varios alimentos", () => {
    expect(splitRemaining(0.5, [carbs.options[0], carbs.options[2]], foods)).toEqual([
      { option: carbs.options[0], grams: 31 },
      { option: carbs.options[2], grams: 31 },
    ]);
    expect(splitRemaining(0, [carbs.options[0]], foods)).toEqual([]);
  });

  it("redondea para pesar", () => {
    expect(roundGrams(62.4)).toBe(60);
    expect(roundGrams(22.4)).toBe(22);
    expect(roundGrams(0.2)).toBe(1);
    expect(roundGrams(0)).toBe(0);
  });

  it("suma macros", () => {
    const t = totalsOf(
      [
        { food_id: "huevo", grams: 120 },
        { food_id: "platano", grams: 120 },
      ],
      foods,
    );
    expect(Math.round(t.kcal)).toBe(Math.round(143 * 1.2 + 89 * 1.2));
    expect(t.protein_g).toBeCloseTo(12.6 * 1.2 + 1.1 * 1.2);
  });

  it("estima los macros de una ración del grupo", () => {
    const t = groupPortionTotals(protein, foods);
    // huevos 171,6 kcal y queso 115 kcal → mediana 143,3
    expect(t.kcal).toBeCloseTo((171.6 + 115) / 2);
  });
});

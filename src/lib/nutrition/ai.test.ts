import { describe, expect, it } from "vitest";
import {
  cheatEstimateSchema,
  mealLogPrompt,
  mealLogSchema,
  mealPrompt,
  mealSuggestionSchema,
  resolveMealLog,
  resolveProposals,
} from "./ai";
import type { Food, PlanGroup } from "./portions";

const foods = new Map<string, Food>(
  [
    { id: "arroz", name: "Arroz", kcal: 350, protein_g: 7, carbs_g: 78, fat_g: 1, unit_label: null, unit_grams: null },
    {
      id: "patata",
      name: "Patata",
      kcal: 80,
      protein_g: 2,
      carbs_g: 17,
      fat_g: 0.1,
      unit_label: null,
      unit_grams: null,
    },
    {
      id: "pollo",
      name: "Pollo",
      kcal: 110,
      protein_g: 23,
      carbs_g: 0,
      fat_g: 1.5,
      unit_label: null,
      unit_grams: null,
    },
  ].map((f) => [f.id, f]),
);

const hc: PlanGroup = {
  id: "hc",
  name: "Hidratos",
  kind: "carbs",
  options: [
    { id: "o-arroz", food_id: "arroz", amount: 150, unit: "g" },
    { id: "o-patata", food_id: "patata", amount: 675, unit: "g" },
  ],
};
const prote: PlanGroup = {
  id: "prote",
  name: "Proteína",
  kind: "protein",
  options: [{ id: "o-pollo", food_id: "pollo", amount: 150, unit: "g" }],
};

describe("IA de nutrición", () => {
  it("el prompt lista grupos, opciones y lo que falta", () => {
    const p = mealPrompt("Comida", [{ group: hc, remaining: 0.5 }], foods, "algo rápido");
    expect(p).toContain('group_id "hc"');
    expect(p).toContain("faltan 0.50 raciones");
    expect(p).toContain('option_id "o-patata": Patata (675 g = 1 ración)');
    expect(p).toContain("algo rápido");
  });

  it("calcula los gramos a partir de los repartos y descarta lo inventado", () => {
    const suggestion = mealSuggestionSchema.parse({
      proposals: [
        {
          title: "Pollo con arroz y patata",
          description: "A la plancha",
          groups: [
            {
              group_id: "hc",
              picks: [
                { option_id: "o-arroz", share: 0.5 },
                { option_id: "o-patata", share: 0.5 },
                { option_id: "inventado", share: 0.3 },
              ],
            },
            { group_id: "prote", picks: [{ option_id: "o-pollo", share: 1 }] },
          ],
        },
        // No cubre todos los grupos: se descarta
        { title: "Solo arroz", groups: [{ group_id: "hc", picks: [{ option_id: "o-arroz", share: 1 }] }] },
      ],
    });
    const out = resolveProposals(
      suggestion,
      [
        { group: hc, remaining: 1 },
        { group: prote, remaining: 0.5 },
      ],
      foods,
    );
    expect(out).toHaveLength(1);
    expect(out[0].items).toEqual([
      { group_id: "hc", option_id: "o-arroz", food_id: "arroz", grams: 75 },
      { group_id: "hc", option_id: "o-patata", food_id: "patata", grams: 340 },
      { group_id: "prote", option_id: "o-pollo", food_id: "pollo", grams: 75 },
    ]);
  });

  it("normaliza repartos que no suman 1", () => {
    const out = resolveProposals(
      mealSuggestionSchema.parse({
        proposals: [{ title: "x", groups: [{ group_id: "hc", picks: [{ option_id: "o-arroz", share: 0.4 }] }] }],
      }),
      [{ group: hc, remaining: 1 }],
      foods,
    );
    expect(out[0].items[0].grams).toBe(150);
  });

  it("acepta números como texto en las estimaciones", () => {
    expect(cheatEstimateSchema.parse({ kcal: "1450", protein_g: 50, carbs_g: "160", fat_g: 60 })).toMatchObject({
      kcal: 1450,
      carbs_g: 160,
      notes: "",
    });
  });
});

describe("registro rápido con IA", () => {
  const foods = new Map(
    [
      {
        id: "pollo",
        name: "Pechuga de pollo",
        kcal: 110,
        protein_g: 23,
        carbs_g: 0,
        fat_g: 1.5,
        unit_label: null,
        unit_grams: null,
      },
      {
        id: "arroz",
        name: "Arroz",
        kcal: 350,
        protein_g: 7,
        carbs_g: 78,
        fat_g: 1,
        unit_label: null,
        unit_grams: null,
      },
      {
        id: "arroz-cocido",
        name: "Arroz cocido",
        kcal: 130,
        protein_g: 2.7,
        carbs_g: 28,
        fat_g: 0.3,
        unit_label: null,
        unit_grams: null,
        cooked_from: "arroz",
        cooked_factor: 2.5,
      },
    ].map((f) => [f.id, f]),
  );
  const groups = [
    {
      id: "g1",
      name: "Proteína",
      kind: "protein" as const,
      options: [{ id: "o1", food_id: "pollo", amount: 150, unit: "g" as const }],
    },
    {
      id: "g2",
      name: "Hidratos",
      kind: "carbs" as const,
      options: [{ id: "o2", food_id: "arroz", amount: 80, unit: "g" as const }],
    },
  ];

  it("lista grupos y catálogo en el prompt", () => {
    const p = mealLogPrompt("Comida", groups, [...foods.values()], foods, "pollo con arroz", false);
    expect(p).toContain('group_id "g1"');
    expect(p).toContain('food_id "arroz-cocido": Arroz cocido');
    expect(p).toContain("pollo con arroz");
  });

  it("valida ids, asigna grupo por el plan (también a los cocidos) y separa lo desconocido", () => {
    const r = resolveMealLog(
      mealLogSchema.parse({
        items: [
          { food_id: "pollo", grams: "148.6", group_id: "inventado" },
          { food_id: "arroz-cocido", grams: 200 },
          { food_id: null, name: "Salsa barbacoa", grams: 20 },
          { food_id: "nope", name: "", grams: 10 },
        ],
        notes: "ración normal",
      }),
      groups,
      foods,
    );
    expect(r).toEqual({
      items: [
        { food_id: "pollo", grams: 149, group_id: "g1" },
        { food_id: "arroz-cocido", grams: 200, group_id: "g2" },
      ],
      unknown: ["Salsa barbacoa"],
      notes: "ración normal",
    });
  });
});

// Cálculo de raciones de un plan por intercambios.
// Cada grupo de una comida (proteína, hidratos…) tiene varias opciones equivalentes:
// "125 g de tortitas" = "125 g de crema de arroz" = 1 ración. Se puede mezclar:
// 60 g de tortitas son 0,48 raciones y lo que falta se puede completar con cualquier opción.
// Si se come algo que no está en la lista (arroz cocido en el desayuno), se compara por el
// macro principal del grupo (hidratos en los grupos de hidratos y fruta, proteína en los de proteína…).

export const GROUP_KINDS = ["protein", "carbs", "fat", "fruit", "dairy", "veg", "supplement", "other"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  protein: "Proteína",
  carbs: "Hidratos",
  fat: "Grasas",
  fruit: "Fruta",
  dairy: "Lácteos",
  veg: "Verdura",
  supplement: "Suplemento",
  other: "Otros",
};

export type Macro = "protein_g" | "carbs_g" | "fat_g" | "kcal";

export const KEY_MACRO: Record<GroupKind, Macro | null> = {
  protein: "protein_g",
  carbs: "carbs_g",
  fruit: "carbs_g",
  fat: "fat_g",
  dairy: "kcal",
  supplement: "kcal",
  other: "kcal",
  veg: null, // libre: la nutricionista no limita la verdura
};

export const MACRO_LABELS: Record<Macro, string> = {
  protein_g: "proteína",
  carbs_g: "hidratos",
  fat_g: "grasa",
  kcal: "kcal",
};

export interface Food {
  id: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  unit_label: string | null;
  unit_grams: number | null;
  /** Versión cocida de otro alimento: peso cocido = peso crudo × cooked_factor. */
  cooked_from?: string | null;
  cooked_factor?: number | null;
}

export interface PlanOption {
  id: string;
  food_id: string;
  amount: number;
  unit: "g" | "ml" | "ud";
}

export interface PlanGroup {
  id: string;
  name: string;
  kind: GroupKind;
  options: PlanOption[];
}

export interface LogEntry {
  id: string;
  food_id: string;
  grams: number;
  group_id: string | null;
}

/** Gramos de una ración de esa opción (las unidades se pasan a gramos con el peso por unidad). */
export function optionGrams(option: PlanOption, food: Food | undefined): number {
  if (option.unit === "ud") return option.amount * (food?.unit_grams ?? 100);
  return option.amount; // ml ≈ g
}

/** Cantidad de un macro en unos gramos de alimento. */
export function macroIn(food: Food, grams: number, macro: Macro): number {
  return (food[macro] * grams) / 100;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Cantidad del macro principal que vale una ración del grupo (mediana de sus opciones). */
export function groupTarget(group: PlanGroup, foods: Map<string, Food>): number {
  const macro = KEY_MACRO[group.kind];
  if (!macro) return 0;
  return median(
    group.options
      .map((o) => {
        const food = foods.get(o.food_id);
        return food ? macroIn(food, optionGrams(o, food), macro) : null;
      })
      .filter((v): v is number => v !== null && v > 0),
  );
}

/**
 * Fracción de ración que supone una cantidad de un alimento dentro de un grupo.
 * Orden: 1) el alimento está en la lista; 2) es la versión cocida de uno de la lista
 * (los pesos del plan son en crudo: 125 g de arroz cocido / 2,5 = 50 g de arroz);
 * 3) si no, se compara por el macro principal del grupo.
 */
export function portionOf(foodId: string, grams: number, group: PlanGroup, foods: Map<string, Food>): number {
  const option = group.options.find((o) => o.food_id === foodId);
  const food = foods.get(foodId);
  if (option) {
    const per = optionGrams(option, food);
    return per > 0 ? grams / per : 0;
  }
  if (food?.cooked_from && food.cooked_factor) {
    const rawOption = group.options.find((o) => o.food_id === food.cooked_from);
    if (rawOption) {
      const per = optionGrams(rawOption, foods.get(food.cooked_from));
      return per > 0 ? grams / food.cooked_factor / per : 0;
    }
  }
  const macro = KEY_MACRO[group.kind];
  const target = groupTarget(group, foods);
  if (!macro || !food || target <= 0) return 0;
  return macroIn(food, grams, macro) / target;
}

/** Redondeo cómodo para pesar: de 5 en 5 g por encima de 50 g, de 1 en 1 por debajo. */
export function roundGrams(g: number): number {
  if (g <= 0) return 0;
  return g >= 50 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g));
}

/** Unidades redondeadas a medias (1,5 huevos). */
export const roundUnits = (u: number) => Math.round(u * 2) / 2;

export interface RemainingOption {
  option: PlanOption;
  food: Food | undefined;
  grams: number;
  units: number | null;
  /** Lo mismo pesado en cocido (arroz, pasta…), si hay versión cocida. */
  cooked: { food: Food; grams: number }[];
}

/** Versiones cocidas de un alimento crudo. */
export function cookedVersions(rawId: string, foods: Map<string, Food>): Food[] {
  return [...foods.values()].filter((f) => f.cooked_from === rawId && f.cooked_factor);
}

export interface GroupProgress {
  group: PlanGroup;
  eaten: number; // raciones comidas (0,48 = 48 %)
  remaining: number; // raciones que faltan (0 si se ha llegado o pasado)
  logs: LogEntry[];
  options: RemainingOption[]; // cuánto falta de cada opción para completar la ración
}

export function groupProgress(group: PlanGroup, logs: LogEntry[], foods: Map<string, Food>): GroupProgress {
  const cookedByRaw = new Map<string, Food[]>();
  for (const f of foods.values()) {
    if (f.cooked_from && f.cooked_factor)
      cookedByRaw.set(f.cooked_from, [...(cookedByRaw.get(f.cooked_from) ?? []), f]);
  }
  const mine = logs.filter((l) => l.group_id === group.id);
  const eaten = mine.reduce((s, l) => s + portionOf(l.food_id, l.grams, group, foods), 0);
  const remaining = group.kind === "veg" ? 0 : Math.max(0, 1 - eaten);
  return {
    group,
    eaten,
    remaining,
    logs: mine,
    options: group.options.map((option) => {
      const food = foods.get(option.food_id);
      const grams = optionGrams(option, food) * remaining;
      return {
        option,
        food,
        grams: roundGrams(grams),
        units: option.unit === "ud" ? roundUnits(option.amount * remaining) : null,
        cooked: (cookedByRaw.get(option.food_id) ?? []).map((c) => ({
          food: c,
          grams: roundGrams(grams * c.cooked_factor!),
        })),
      };
    }),
  };
}

/**
 * Reparte lo que falta de un grupo entre varios alimentos elegidos a partes iguales
 * (p. ej. la mitad en arroz y la mitad en patata).
 */
export function splitRemaining(
  remaining: number,
  picks: PlanOption[],
  foods: Map<string, Food>,
): { option: PlanOption; grams: number }[] {
  if (picks.length === 0 || remaining <= 0) return [];
  const share = remaining / picks.length;
  return picks.map((option) => ({ option, grams: roundGrams(optionGrams(option, foods.get(option.food_id)) * share) }));
}

export interface Totals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function totalsOf(entries: { food_id: string; grams: number }[], foods: Map<string, Food>): Totals {
  const t: Totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const e of entries) {
    const food = foods.get(e.food_id);
    if (!food) continue;
    for (const m of ["kcal", "protein_g", "carbs_g", "fat_g"] as const) t[m] += macroIn(food, e.grams, m);
  }
  return t;
}

/** Macros aproximados de una ración de cada grupo (mediana de sus opciones), para el total del plan. */
export function groupPortionTotals(group: PlanGroup, foods: Map<string, Food>): Totals {
  const per = group.options
    .map((o) => {
      const food = foods.get(o.food_id);
      return food ? totalsOf([{ food_id: food.id, grams: optionGrams(o, food) }], foods) : null;
    })
    .filter((t): t is Totals => t !== null);
  return {
    kcal: median(per.map((t) => t.kcal)),
    protein_g: median(per.map((t) => t.protein_g)),
    carbs_g: median(per.map((t) => t.carbs_g)),
    fat_g: median(per.map((t) => t.fat_g)),
  };
}

export function sumTotals(list: Totals[]): Totals {
  return list.reduce(
    (a, t) => ({
      kcal: a.kcal + t.kcal,
      protein_g: a.protein_g + t.protein_g,
      carbs_g: a.carbs_g + t.carbs_g,
      fat_g: a.fat_g + t.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

/** Cómo describir una cantidad de una opción: "2 huevos", "125 g", "200 ml". */
export function describeAmount(amount: number, unit: PlanOption["unit"], food?: Food): string {
  const n = amount.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  if (unit === "ud") return `${n} ${food?.unit_label ?? "ud."}`;
  return `${n} ${unit}`;
}

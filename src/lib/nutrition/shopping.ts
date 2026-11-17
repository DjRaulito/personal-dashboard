// Lista de la compra: cuánto se gasta a la semana de cada alimento elegido del plan.
// Para cada opción elegida se indica cuántos días a la semana se come; la cantidad es la
// ración del plan (en crudo) por esos días, sumada entre todas las comidas donde aparece.
import { optionGrams, type Food, type PlanGroup } from "./portions";

export interface ShoppingMeal {
  id: string;
  name: string;
  groups: PlanGroup[];
}

export interface ShoppingLine {
  food: Food;
  /** Gramos (o ml) a la semana. */
  grams: number;
  /** Unidades a la semana, si el alimento se cuenta por unidades. */
  units: number | null;
  /** Coste semanal en céntimos; null si el alimento no tiene precio. */
  cents: number | null;
  /** Comidas donde se usa y cuántos días. */
  uses: { meal: string; days: number }[];
}

export interface ShoppingSummary {
  lines: ShoppingLine[];
  /** Suma de los alimentos con precio, en céntimos por semana. */
  totalCents: number;
  /** Alimentos elegidos que aún no tienen precio. */
  unpriced: number;
}

export function weeklyShopping(
  meals: ShoppingMeal[],
  picks: Map<string, number>,
  foods: Map<string, Food>,
): ShoppingSummary {
  const byFood = new Map<string, ShoppingLine>();
  for (const meal of meals) {
    for (const group of meal.groups) {
      for (const option of group.options) {
        const days = picks.get(option.id) ?? 0;
        const food = foods.get(option.food_id);
        if (!food || days <= 0) continue;
        const line = byFood.get(food.id) ?? { food, grams: 0, units: null, cents: null, uses: [] };
        line.grams += optionGrams(option, food) * days;
        const use = line.uses.find((u) => u.meal === meal.name);
        if (use) use.days += days;
        else line.uses.push({ meal: meal.name, days });
        byFood.set(food.id, line);
      }
    }
  }
  const lines = [...byFood.values()].map((line) => {
    const { food } = line;
    const price = food.price_cents_per_kg;
    return {
      ...line,
      grams: Math.round(line.grams),
      units: food.unit_grams ? Math.round((line.grams / food.unit_grams) * 10) / 10 : null,
      cents: price === null || price === undefined ? null : Math.round((line.grams / 1000) * price),
    };
  });
  lines.sort((a, b) => (b.cents ?? -1) - (a.cents ?? -1) || a.food.name.localeCompare(b.food.name, "es"));
  return {
    lines,
    totalCents: lines.reduce((s, l) => s + (l.cents ?? 0), 0),
    unpriced: lines.filter((l) => l.cents === null).length,
  };
}

/** Días elegidos en un grupo (lo normal es que sumen 7: una opción cada día). */
export function groupDays(group: PlanGroup, picks: Map<string, number>): number {
  return group.options.reduce((s, o) => s + (picks.get(o.id) ?? 0), 0);
}

/** "1,2 kg", "350 g". */
export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg`;
  return `${Math.round(grams).toLocaleString("es-ES")} g`;
}

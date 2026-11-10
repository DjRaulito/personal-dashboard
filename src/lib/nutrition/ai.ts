// Prompts y esquemas de las funciones de IA de nutrición (sin dependencias de servidor, testeables).
import { z } from "zod";
import { optionGrams, roundGrams, type Food, type PlanGroup } from "./portions";

export const SYSTEM_NUTRITION =
  "Eres un dietista-nutricionista español. Respondes SIEMPRE con un único objeto JSON válido, sin texto adicional. " +
  "Los valores nutricionales son estimaciones realistas basadas en tablas españolas (BEDCA) y en raciones habituales en España.";

const num = (max: number) => z.coerce.number().min(0).max(max);

// ---------------------------------------------------------------------------
// Estimación de un cheat meal
// ---------------------------------------------------------------------------

export const cheatEstimateSchema = z.object({
  kcal: num(20000),
  protein_g: num(2000),
  carbs_g: num(2000),
  fat_g: num(2000),
  notes: z.string().max(1000).optional().default(""),
});
export type CheatEstimate = z.infer<typeof cheatEstimateSchema>;

export function cheatPrompt(description: string): string {
  return [
    "Estima las calorías y macros totales de esta comida libre (cheat meal).",
    "Si no se indican cantidades, asume raciones normales de restaurante en España.",
    'Devuelve: {"kcal": número, "protein_g": número, "carbs_g": número, "fat_g": número, "notes": "qué has supuesto, en una frase"}',
    `Comida: """${description.slice(0, 1000)}"""`,
  ].join("\n");
}

export const cheatPhotoSchema = cheatEstimateSchema.extend({
  description: z.string().max(300).optional().default(""),
});
export type CheatPhotoEstimate = z.infer<typeof cheatPhotoSchema>;

export function cheatPhotoPrompt(hint: string): string {
  return [
    "Mira la foto del plato y estima las calorías y macros totales de lo que se ve.",
    "Calcula el tamaño de las raciones por el plato, los cubiertos y el envase. Si hay varias personas, cuenta solo una ración.",
    hint ? `Detalles que da el usuario: """${hint.slice(0, 500)}"""` : "",
    'Devuelve: {"description": "qué comida es, en pocas palabras", "kcal": número, "protein_g": número, "carbs_g": número, "fat_g": número, "notes": "qué has supuesto, en una frase"}',
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Macros de un alimento nuevo
// ---------------------------------------------------------------------------

export const foodEstimateSchema = z.object({
  kcal: num(1000),
  protein_g: num(100),
  carbs_g: num(100),
  fat_g: num(100),
  unit_label: z.string().max(30).nullable().optional(),
  unit_grams: z.coerce.number().positive().max(5000).nullable().optional(),
});
export type FoodEstimate = z.infer<typeof foodEstimateSchema>;

export function foodPrompt(name: string): string {
  return [
    "Da los valores nutricionales por 100 g (o 100 ml) de este alimento tal y como se pesa (crudo si se pesa en crudo, cocido si dice cocido).",
    "Si se suele contar por unidades (huevo, pieza de fruta, lata, yogur…), indica unit_label (en singular) y unit_grams (peso de una unidad).",
    'Devuelve: {"kcal": n, "protein_g": n, "carbs_g": n, "fat_g": n, "unit_label": texto o null, "unit_grams": n o null}',
    `Alimento: """${name.slice(0, 80)}"""`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Propuestas de comida: la IA elige alimentos y cómo repartir lo que falta;
// los gramos los calcula la app con las equivalencias del plan.
// ---------------------------------------------------------------------------

export const mealSuggestionSchema = z.object({
  proposals: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        description: z.string().max(400).optional().default(""),
        groups: z.array(
          z.object({
            group_id: z.string(),
            picks: z.array(z.object({ option_id: z.string(), share: z.coerce.number().min(0).max(1) })).max(4),
          }),
        ),
      }),
    )
    .min(1)
    .max(5),
});
export type MealSuggestion = z.infer<typeof mealSuggestionSchema>;

export interface PendingGroup {
  group: PlanGroup;
  remaining: number; // raciones que faltan
}

export function mealPrompt(
  mealName: string,
  pending: PendingGroup[],
  foods: Map<string, Food>,
  wishes: string,
): string {
  const lines = pending.map(({ group, remaining }) => {
    const opts = group.options
      .map((o) => `    - option_id "${o.id}": ${foods.get(o.food_id)?.name ?? "?"} (${o.amount} ${o.unit} = 1 ración)`)
      .join("\n");
    return `  · group_id "${group.id}" — ${group.name}: faltan ${remaining.toFixed(2)} raciones. Opciones:\n${opts}`;
  });
  return [
    `Comida: ${mealName}. Hay que completar lo que falta de estos grupos de un plan por intercambios:`,
    ...lines,
    "",
    "Ojo: los pesos del plan son en crudo (el arroz cocido pesa unas 2,5 veces más y la pasta unas 2).",
    "Propón 3 platos distintos y apetecibles. En cada grupo puedes usar 1 alimento o mezclar 2-3 opciones del mismo grupo.",
    "Para cada grupo indica qué opciones usas y qué parte (share, entre 0 y 1) de lo que falta cubre cada una; los share de un grupo deben sumar 1.",
    "No inventes option_id: usa solo los de la lista. No indiques gramos: la app los calcula.",
    wishes ? `Preferencias del usuario: """${wishes.slice(0, 300)}"""` : "",
    'Devuelve: {"proposals": [{"title": "nombre del plato", "description": "cómo prepararlo en 1-2 frases", "groups": [{"group_id": "...", "picks": [{"option_id": "...", "share": 0.5}]}]}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ResolvedProposal {
  title: string;
  description: string;
  items: { group_id: string; option_id: string; food_id: string; grams: number }[];
}

/** Valida una propuesta contra el plan (ids reales, shares normalizados) y calcula los gramos. */
export function resolveProposals(
  suggestion: MealSuggestion,
  pending: PendingGroup[],
  foods: Map<string, Food>,
): ResolvedProposal[] {
  const byGroup = new Map(pending.map((p) => [p.group.id, p]));
  const out: ResolvedProposal[] = [];
  for (const proposal of suggestion.proposals) {
    const items: ResolvedProposal["items"] = [];
    const covered = new Set<string>();
    for (const g of proposal.groups) {
      const p = byGroup.get(g.group_id);
      if (!p || covered.has(g.group_id)) continue;
      const picks = g.picks
        .map((pick) => ({ pick, option: p.group.options.find((o) => o.id === pick.option_id) }))
        .filter((x): x is { pick: (typeof g.picks)[number]; option: PlanGroup["options"][number] } => !!x.option)
        .filter((x) => x.pick.share > 0);
      const total = picks.reduce((s, x) => s + x.pick.share, 0);
      if (total <= 0) continue;
      covered.add(g.group_id);
      for (const { pick, option } of picks) {
        const grams = roundGrams(optionGrams(option, foods.get(option.food_id)) * p.remaining * (pick.share / total));
        if (grams > 0) items.push({ group_id: g.group_id, option_id: option.id, food_id: option.food_id, grams });
      }
    }
    // Solo propuestas que cubren todos los grupos pendientes
    if (items.length && pending.every((p) => covered.has(p.group.id))) {
      out.push({ title: proposal.title, description: proposal.description, items });
    }
  }
  return out;
}

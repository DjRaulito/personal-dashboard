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

// La IA desglosa plato a plato (gramos y macros de cada uno) y la app suma: pedir solo el total
// hacía que devolviera cifras redondas parecidas (p. ej. 1700) para comidas muy distintas.
const cheatItemSchema = z.object({
  name: z.string().max(120),
  grams: num(5000),
  kcal: num(10000).optional(),
  protein_g: num(1000),
  carbs_g: num(1000),
  fat_g: num(1000),
});

const cheatRawSchema = z.object({
  items: z.array(cheatItemSchema).max(30).optional(),
  kcal: num(20000).optional(),
  protein_g: num(2000).optional(),
  carbs_g: num(2000).optional(),
  fat_g: num(2000).optional(),
  notes: z.string().max(1000).optional().default(""),
});

const round = (v: number) => Math.round(v);
/** Kcal de unos macros (Atwater: 4 / 4 / 9). */
const kcalOf = (m: { protein_g: number; carbs_g: number; fat_g: number }) =>
  m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;

function cheatTotals(raw: z.infer<typeof cheatRawSchema>) {
  const items = raw.items ?? [];
  if (items.length === 0) {
    const m = { protein_g: raw.protein_g ?? 0, carbs_g: raw.carbs_g ?? 0, fat_g: raw.fat_g ?? 0 };
    return { kcal: round(raw.kcal ?? kcalOf(m)), ...m, notes: raw.notes };
  }
  const sum = (k: "protein_g" | "carbs_g" | "fat_g") => round(items.reduce((s, i) => s + i[k], 0));
  const macros = { protein_g: sum("protein_g"), carbs_g: sum("carbs_g"), fat_g: sum("fat_g") };
  // Kcal de cada plato: la de la IA si es coherente con sus macros; si no, la de los macros
  const kcal = round(
    items.reduce((s, i) => {
      const fromMacros = kcalOf(i);
      return s + (i.kcal && Math.abs(i.kcal - fromMacros) <= fromMacros * 0.15 ? i.kcal : fromMacros);
    }, 0),
  );
  const breakdown = items.map((i) => `${i.name} (${round(i.grams)} g)`).join(", ");
  const notes = [breakdown, raw.notes].filter(Boolean).join(". ").slice(0, 1000);
  return { kcal, ...macros, notes };
}

export const cheatEstimateSchema = cheatRawSchema.transform(cheatTotals);
export type CheatEstimate = z.infer<typeof cheatEstimateSchema>;

const ITEMS_FORMAT =
  '"items": [{"name": "plato o alimento", "grams": peso de la ración en gramos, "kcal": n, "protein_g": n, "carbs_g": n, "fat_g": n}]';
const ITEMS_RULES = [
  "Desglosa la comida en cada plato, bebida, salsa y postre por separado, con su peso en gramos y los macros de ESA cantidad.",
  "Respeta las cantidades que se indiquen (unidades, tamaños, si era abundante o con más azúcar o aceite de lo normal).",
  "No redondees a cifras redondas: calcula cada plato con tablas reales (BEDCA, cartas de las cadenas si se nombran).",
];

export function cheatPrompt(description: string): string {
  return [
    "Estima las calorías y macros de esta comida libre (cheat meal).",
    ...ITEMS_RULES,
    "Si no se indican cantidades, asume raciones normales de restaurante en España.",
    `Devuelve: {${ITEMS_FORMAT}, "notes": "qué has supuesto, en una frase"}`,
    `Comida: """${description.slice(0, 1000)}"""`,
  ].join("\n");
}

export const cheatPhotoSchema = cheatRawSchema
  .extend({ description: z.string().max(300).optional().default("") })
  .transform((raw) => ({ ...cheatTotals(raw), description: raw.description }));
export type CheatPhotoEstimate = z.infer<typeof cheatPhotoSchema>;

export function cheatPhotoPrompt(hint: string): string {
  return [
    "Mira la foto del plato y estima las calorías y macros de lo que se ve.",
    "Calcula el tamaño de las raciones por el plato, los cubiertos y el envase. Si hay varias personas, cuenta solo una ración.",
    ...ITEMS_RULES,
    hint ? `Detalles que da el usuario: """${hint.slice(0, 500)}"""` : "",
    `Devuelve: {"description": "qué comida es, en pocas palabras", ${ITEMS_FORMAT}, "notes": "qué has supuesto, en una frase"}`,
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
// Chef: la IA elige alimentos, cómo repartir cada macro entre ellos y la receta;
// los gramos los calcula la app con las equivalencias del plan.
// ---------------------------------------------------------------------------

export const mealSuggestionSchema = z.object({
  proposals: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        description: z.string().max(400).optional().default(""),
        steps: z.array(z.string().max(300)).max(8).optional().default([]),
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
  remaining: number; // raciones que hay que cubrir (1 = la ración entera)
}

export interface ChefOptions {
  /** En cuántos alimentos como máximo se reparte cada macro (1 = sin mezclar). */
  maxPerGroup: number;
  /** Alimentos obligatorios por grupo: id del grupo → ids de las opciones que hay que usar. */
  pins: Record<string, string[]>;
  wishes: string;
}

export function mealPrompt(
  mealName: string,
  pending: PendingGroup[],
  foods: Map<string, Food>,
  { maxPerGroup, pins, wishes }: ChefOptions,
): string {
  const lines = pending.map(({ group, remaining }) => {
    const pinned = new Set(pins[group.id] ?? []);
    const options = pinned.size ? group.options.filter((o) => pinned.has(o.id)) : group.options;
    const opts = options
      .map((o) => `    - option_id "${o.id}": ${foods.get(o.food_id)?.name ?? "?"} (${o.amount} ${o.unit} = 1 ración)`)
      .join("\n");
    const rule = pinned.size ? "Usa TODAS estas opciones" : "Opciones";
    return `  · group_id "${group.id}" — ${group.name}: hay que cubrir ${remaining.toFixed(2)} raciones. ${rule}:\n${opts}`;
  });
  return [
    `Comida: ${mealName}. Hay que cubrir estos grupos de un plan por intercambios:`,
    ...lines,
    "",
    "Ojo: los pesos del plan son en crudo (el arroz cocido pesa unas 2,5 veces más y la pasta unas 2).",
    "Propón 3 platos distintos y apetecibles, de cocina casera española, que se preparen en poco tiempo.",
    maxPerGroup <= 1
      ? "En cada grupo usa UN solo alimento (salvo en los grupos donde se indica usar todas las opciones)."
      : `En cada grupo puedes usar 1 alimento o repartir el macro entre varios del mismo grupo (hasta ${maxPerGroup}).`,
    "Para cada grupo indica qué opciones usas y qué parte (share, entre 0 y 1) de la ración cubre cada una; los share de un grupo deben sumar 1.",
    "No inventes option_id: usa solo los de la lista. No indiques gramos: la app los calcula.",
    wishes ? `Preferencias del usuario: """${wishes.slice(0, 300)}"""` : "",
    'Devuelve: {"proposals": [{"title": "nombre del plato", "description": "qué es, en una frase", "steps": ["paso 1", "paso 2"], "groups": [{"group_id": "...", "picks": [{"option_id": "...", "share": 0.5}]}]}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ResolvedProposal {
  title: string;
  description: string;
  steps: string[];
  items: { group_id: string; option_id: string; food_id: string; grams: number }[];
}

/**
 * Valida una propuesta contra el plan (ids reales, repartos normalizados) y calcula los gramos.
 * Aplica lo que pidió el usuario aunque la IA no lo respete: los alimentos obligatorios entran
 * siempre (a partes iguales si la IA los ignoró) y no se pasa del máximo de alimentos por grupo.
 */
export function resolveProposals(
  suggestion: MealSuggestion,
  pending: PendingGroup[],
  foods: Map<string, Food>,
  options: Pick<ChefOptions, "maxPerGroup" | "pins"> = { maxPerGroup: 4, pins: {} },
): ResolvedProposal[] {
  const byGroup = new Map(pending.map((p) => [p.group.id, p]));
  const out: ResolvedProposal[] = [];
  for (const proposal of suggestion.proposals) {
    const items: ResolvedProposal["items"] = [];
    const covered = new Set<string>();
    for (const g of proposal.groups) {
      const p = byGroup.get(g.group_id);
      if (!p || covered.has(g.group_id)) continue;
      const pinned = (options.pins[g.group_id] ?? []).filter((id) => p.group.options.some((o) => o.id === id));
      const shares = new Map<string, number>();
      for (const pick of g.picks) {
        if (pick.share <= 0 || !p.group.options.some((o) => o.id === pick.option_id)) continue;
        if (pinned.length && !pinned.includes(pick.option_id)) continue;
        shares.set(pick.option_id, (shares.get(pick.option_id) ?? 0) + pick.share);
      }
      if (pinned.length) {
        // Los obligatorios que la IA dejó fuera entran con la media de los demás
        const present = [...shares.values()];
        const fallback = present.length ? present.reduce((s, v) => s + v, 0) / present.length : 1;
        for (const id of pinned) if (!shares.has(id)) shares.set(id, fallback);
      } else if (shares.size > options.maxPerGroup) {
        const top = [...shares].sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, options.maxPerGroup));
        shares.clear();
        for (const [id, share] of top) shares.set(id, share);
      }
      const total = [...shares.values()].reduce((s, v) => s + v, 0);
      if (total <= 0) continue;
      covered.add(g.group_id);
      for (const option of p.group.options) {
        const share = shares.get(option.id);
        if (!share) continue;
        const grams = roundGrams(optionGrams(option, foods.get(option.food_id)) * p.remaining * (share / total));
        if (grams > 0) items.push({ group_id: g.group_id, option_id: option.id, food_id: option.food_id, grams });
      }
    }
    // Solo propuestas que cubren todos los grupos pedidos
    if (items.length && pending.every((p) => covered.has(p.group.id))) {
      out.push({
        title: proposal.title,
        description: proposal.description,
        steps: proposal.steps.map((s) => s.trim()).filter(Boolean),
        items,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Precio aproximado de los alimentos (lista de la compra)
// ---------------------------------------------------------------------------

export const priceEstimateSchema = z.object({
  prices: z.array(z.object({ n: z.coerce.number().int().min(0), eur_per_kg: z.coerce.number().min(0).max(500) })),
});
export type PriceEstimate = z.infer<typeof priceEstimateSchema>;

export function pricePrompt(names: string[]): string {
  return [
    "Da el precio aproximado actual en un supermercado español (marca blanca, tipo Mercadona) de estos alimentos.",
    "En euros por kilo del producto tal y como se compra (por litro si es líquido). Si se vende por unidades o envases, conviértelo a euros por kilo.",
    ...names.map((name, i) => `  ${i}. ${name.slice(0, 80)}`),
    'Devuelve: {"prices": [{"n": número de la lista, "eur_per_kg": número}]}',
  ].join("\n");
}

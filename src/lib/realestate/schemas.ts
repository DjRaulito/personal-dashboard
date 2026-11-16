import { z } from "zod";

// Inmuebles: lo que guarda la IA (datos, no informes) y los supuestos que edita Raúl.
// Importes en céntimos dentro de la app; la IA los manda en euros y se convierten aquí.

export const CONDITIONS = [
  "a_reformar",
  "para_actualizar",
  "buen_estado",
  "reformado",
  "obra_nueva",
  "desconocido",
] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<Condition, string> = {
  a_reformar: "A reformar",
  para_actualizar: "Para actualizar",
  buen_estado: "Buen estado",
  reformado: "Reformado",
  obra_nueva: "Obra nueva",
  desconocido: "Sin datos",
};

export const CONFIDENCES = ["alta", "media", "baja"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const LISTING_STATES = ["activo", "retirado", "desconocido"] as const;
export type ListingState = (typeof LISTING_STATES)[number];

/** Estado que decide Raúl en la web. */
export const STATUSES = ["nuevo", "investigar", "negociar", "esperar", "descartado"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = {
  nuevo: "Nuevo",
  investigar: "Investigar",
  negociar: "Negociar",
  esperar: "Esperar rebaja",
  descartado: "Descartado",
};

export const PROVENANCES = ["verificado", "anunciante", "estimado"] as const;
export type Provenance = (typeof PROVENANCES)[number];

/** Campos cuyo origen se puede marcar. */
export const PROVENANCE_FIELDS = [
  "price",
  "sqm",
  "rooms",
  "condition",
  "rent",
  "rent_cap",
  "reform_cost",
  "community_fee",
  "ibi",
  "market_price_sqm",
] as const;

// ---------------------------------------------------------------------------
// Entrada de la IA (euros)
// ---------------------------------------------------------------------------

const euros = (max: number) => z.number().finite().nonnegative().max(max);
const text = (max: number) => z.string().trim().max(max);
const list = (maxItems: number, maxLen = 300) => z.array(text(maxLen).min(1)).max(maxItems).default([]);
const score10 = z.number().min(0).max(10);

const comparable = z.object({
  url: z.url().max(600).optional(),
  price: euros(5_000_000).describe("Venta: precio total; alquiler: renta mensual"),
  sqm: z.number().positive().max(2000).optional(),
  note: text(200).optional(),
});

export const listingInputSchema = z.object({
  url: z.url().max(600),
  source: text(60).optional(),
  title: text(200).optional(),
  municipality: text(80).min(1),
  neighborhood: text(80).optional(),
  photo_url: z.url().max(600).optional(),
  listing_state: z.enum(LISTING_STATES).default("activo"),
  published_on: z.iso.date().optional(),

  price: euros(5_000_000).refine((v) => v > 0, "El precio debe ser mayor que cero"),
  previous_price: euros(5_000_000).optional(),
  sqm: z.number().positive().max(2000).optional(),
  rooms: z.int().min(0).max(20).optional(),
  bathrooms: z.int().min(0).max(10).optional(),
  floor: text(30).optional(),
  elevator: z.boolean().optional(),
  condition: z.enum(CONDITIONS).default("desconocido"),
  energy_rating: text(10).optional(),

  rent: z
    .object({
      conservative: euros(20_000).optional(),
      base: euros(20_000).optional(),
      optimistic: euros(20_000).optional(),
    })
    .default({}),
  rent_cap: euros(20_000).optional(),
  rent_cap_note: text(400).optional(),
  rent_comparables: z.array(comparable).max(10).default([]),
  sale_comparables: z.array(comparable).max(10).default([]),
  market_price_sqm: euros(50_000).optional(),

  reform_cost: euros(1_000_000).optional(),
  furnishing_cost: euros(200_000).optional(),
  community_fee: euros(5_000).optional(),
  ibi: euros(20_000).optional(),

  target_price: euros(5_000_000).optional(),
  negotiation_evidence: text(800).optional(),

  scores: z
    .object({ demand: score10.optional(), appreciation: score10.optional(), safety: score10.optional() })
    .default({}),
  confidence: z.enum(CONFIDENCES).default("media"),
  provenance: z.partialRecord(z.enum(PROVENANCE_FIELDS), z.enum(PROVENANCES)).default({}),

  thesis: text(1500).optional(),
  risks: list(12),
  pending: list(12),
  documents: list(12),
  next_steps: list(10),
  duplicates: z.array(z.url().max(600)).max(10).default([]),
});

export type ListingInput = z.input<typeof listingInputSchema>;

const cents = (v: number | undefined) => (v == null ? undefined : Math.round(v * 100));
const comparableCents = (c: z.infer<typeof comparable>) => ({ ...c, price: Math.round(c.price * 100) });

/** Lo que se guarda en `property_listings.data` (céntimos). */
export function toListingData(input: z.infer<typeof listingInputSchema>) {
  return {
    photo_url: input.photo_url,
    published_on: input.published_on,
    bathrooms: input.bathrooms,
    floor: input.floor,
    elevator: input.elevator,
    condition: input.condition,
    energy_rating: input.energy_rating,
    rent: {
      conservative: cents(input.rent.conservative),
      base: cents(input.rent.base),
      optimistic: cents(input.rent.optimistic),
    },
    rent_cap: cents(input.rent_cap),
    rent_cap_note: input.rent_cap_note,
    rent_comparables: input.rent_comparables.map(comparableCents),
    sale_comparables: input.sale_comparables.map(comparableCents),
    market_price_sqm: cents(input.market_price_sqm),
    reform_cost: cents(input.reform_cost),
    furnishing_cost: cents(input.furnishing_cost),
    community_fee: cents(input.community_fee),
    ibi: cents(input.ibi),
    target_price: cents(input.target_price),
    negotiation_evidence: input.negotiation_evidence,
    scores: input.scores,
    provenance: input.provenance,
    thesis: input.thesis,
    risks: input.risks,
    pending: input.pending,
    documents: input.documents,
    next_steps: input.next_steps,
    duplicates: input.duplicates,
  };
}

/** Datos de un anuncio tal como los lee la app (todo opcional: la base puede tener versiones viejas). */
const centsField = z.number().int().nonnegative().optional();
const storedComparable = z.object({
  url: z.string().optional(),
  price: z.number().int().nonnegative(),
  sqm: z.number().optional(),
  note: z.string().optional(),
});

export const listingDataSchema = z
  .object({
    photo_url: z.string().optional(),
    published_on: z.string().optional(),
    bathrooms: z.number().optional(),
    floor: z.string().optional(),
    elevator: z.boolean().optional(),
    condition: z.enum(CONDITIONS).catch("desconocido").default("desconocido"),
    energy_rating: z.string().optional(),
    rent: z.object({ conservative: centsField, base: centsField, optimistic: centsField }).catch({}).default({}),
    rent_cap: centsField,
    rent_cap_note: z.string().optional(),
    rent_comparables: z.array(storedComparable).catch([]).default([]),
    sale_comparables: z.array(storedComparable).catch([]).default([]),
    market_price_sqm: centsField,
    reform_cost: centsField,
    furnishing_cost: centsField,
    community_fee: centsField,
    ibi: centsField,
    target_price: centsField,
    negotiation_evidence: z.string().optional(),
    scores: z
      .object({ demand: score10.optional(), appreciation: score10.optional(), safety: score10.optional() })
      .catch({})
      .default({}),
    provenance: z.record(z.string(), z.enum(PROVENANCES)).catch({}).default({}),
    thesis: z.string().optional(),
    risks: z.array(z.string()).catch([]).default([]),
    pending: z.array(z.string()).catch([]).default([]),
    documents: z.array(z.string()).catch([]).default([]),
    next_steps: z.array(z.string()).catch([]).default([]),
    duplicates: z.array(z.string()).catch([]).default([]),
  })
  .catch({
    condition: "desconocido",
    rent: {},
    rent_comparables: [],
    sale_comparables: [],
    scores: {},
    provenance: {},
    risks: [],
    pending: [],
    documents: [],
    next_steps: [],
    duplicates: [],
  });

export type ListingData = z.infer<typeof listingDataSchema>;

export const removedInputSchema = z.object({ url: z.url().max(600), reason: text(300).optional() });

export const runInputSchema = z.object({
  examined: z.int().min(0).max(10_000),
  saved: z.int().min(0).max(1000).default(0),
  summary: text(2000).optional(),
});

// ---------------------------------------------------------------------------
// Supuestos y criterios (los edita Raúl; se recalcula todo al momento)
// ---------------------------------------------------------------------------

const pct = (max = 100) => z.coerce.number().min(0).max(max);

export const assumptionsSchema = z.object({
  /** Impuesto de transmisiones patrimoniales (vivienda usada en Cataluña, editable). */
  itp_pct: pct(20).default(10),
  /** Notaría, registro y gestoría sobre el precio. */
  purchase_costs_pct: pct(10).default(1.5),
  appraisal_eur: pct(5000).default(400),
  ltv_pct: pct(100).default(80),
  ltv_alt_pct: pct(100).default(70),
  interest_pct: pct(15).default(3.2),
  term_years: z.coerce.number().int().min(5).max(40).default(30),
  reform_contingency_pct: pct(100).default(10),
  /** Cédula, certificado energético y altas. */
  setup_eur: pct(20_000).default(300),
  vacancy_months: pct(12).default(1),
  maintenance_pct: pct(30).default(5),
  management_pct: pct(30).default(0),
  /** Seguro de impago, sobre la renta anual. */
  default_insurance_pct: pct(15).default(4),
  home_insurance_eur: pct(5000).default(250),
  community_default_eur: pct(1000).default(60),
  ibi_default_eur: pct(10_000).default(350),
});
export type Assumptions = z.infer<typeof assumptionsSchema>;

export const weightsSchema = z.object({
  cashflow: pct().default(30),
  net_yield: pct().default(20),
  price: pct().default(15),
  demand: pct().default(10),
  appreciation: pct().default(10),
  safety: pct().default(15),
});
export type Weights = z.infer<typeof weightsSchema>;

export const criteriaSchema = z.object({
  /** Municipios en orden de prioridad, separados por comas. */
  zones: z.string().trim().max(1000).default(""),
  price_min_eur: pct(5_000_000).default(150_000),
  price_max_eur: pct(5_000_000).default(200_000),
  /** Tope excepcional: solo con margen de negociación demostrable. */
  price_exceptional_eur: pct(5_000_000).default(230_000),
  max_equity_eur: pct(5_000_000).default(50_000),
  gross_min_pct: pct(50).default(8),
  gross_target_pct: pct(50).default(10),
  notes: z.string().trim().max(2000).default(""),
  weights: weightsSchema.default(weightsSchema.parse({})),
});
export type Criteria = z.infer<typeof criteriaSchema>;

export const settingsSchema = z.object({
  assumptions: assumptionsSchema.catch(assumptionsSchema.parse({})).default(assumptionsSchema.parse({})),
  criteria: criteriaSchema.catch(criteriaSchema.parse({})).default(criteriaSchema.parse({})),
});
export type PropertySettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: PropertySettings = settingsSchema.parse({});

/** «Sabadell, Terrassa,, » → ["Sabadell", "Terrassa"] */
export function parseZones(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((z) => z.trim())
        .filter(Boolean),
    ),
  ];
}

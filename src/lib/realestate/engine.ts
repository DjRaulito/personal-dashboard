import type { Assumptions, Criteria, ListingData } from "./schemas";

// Motor de inversión inmobiliaria: todas las cuentas salen de aquí, nunca de la IA.
// Importes en céntimos; porcentajes de los supuestos en «puntos» (10 = 10 %); rentabilidades en tanto por uno.

export type RentScenario = "conservative" | "base" | "optimistic";
export const SCENARIO_LABELS: Record<RentScenario, string> = {
  conservative: "Conservador",
  base: "Base",
  optimistic: "Optimista",
};

export interface ListingFacts {
  /** Precio anunciado (céntimos) */
  price: number;
  sqm: number | null;
  data: ListingData;
}

export interface AnalyzeOptions {
  /** Precio de compra (por defecto, el anunciado) */
  purchasePrice?: number;
  scenario?: RentScenario;
  ltvPct?: number;
  /** Multiplica la renta (0,9 = 10 % menos) */
  rentFactor?: number;
  /** Puntos de interés añadidos */
  rateDelta?: number;
  /** Meses de vacancia añadidos */
  extraVacancy?: number;
}

export interface Opex {
  vacancy: number;
  community: number;
  ibi: number;
  insurance: number;
  maintenance: number;
  management: number;
  defaultInsurance: number;
  total: number;
}

export interface Analysis {
  purchasePrice: number;
  /** Renta mensual usada (ya limitada por el tope legal si lo hay) */
  rent: number;
  /** La renta del escenario superaba el tope legal */
  rentCapped: boolean;
  itp: number;
  /** Notaría, registro, gestoría y tasación */
  purchaseCosts: number;
  reform: number;
  furnishing: number;
  setup: number;
  totalCost: number;
  ltvPct: number;
  loan: number;
  equity: number;
  /** Cuota mensual completa (intereses + principal) */
  payment: number;
  interestPct: number;
  opex: Opex;
  grossYield: number;
  /** Ingresos menos gastos operativos (anual, sin hipoteca) */
  noi: number;
  netYield: number;
  cashflowYear: number;
  cashflowMonth: number;
  /** Cash flow anual / capital propio (null si el capital propio es 0 o negativo) */
  cashOnCash: number | null;
}

const PCT = 0.01;

/** Cuota mensual de un préstamo francés. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  const r = (annualRatePct * PCT) / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

/** Renta del escenario; si falta, se deduce de las otras (conservador = 90 % de la base, optimista = 110 %). */
export function scenarioRent(data: ListingData, scenario: RentScenario): number | null {
  const { conservative, base, optimistic } = data.rent;
  if (scenario === "base") return base ?? (conservative != null ? conservative / 0.9 : null);
  if (scenario === "conservative") return conservative ?? (base != null ? base * 0.9 : null);
  return optimistic ?? (base != null ? base * 1.1 : null);
}

function fixedCosts(data: ListingData, a: Assumptions) {
  const reform = (data.reform_cost ?? 0) * (1 + a.reform_contingency_pct * PCT);
  const furnishing = data.furnishing_cost ?? 0;
  const setup = a.setup_eur * 100;
  const appraisal = a.appraisal_eur * 100;
  return { reform, furnishing, setup, appraisal, total: reform + furnishing + setup + appraisal };
}

function operatingCosts(rent: number, data: ListingData, a: Assumptions, extraVacancy = 0): Opex {
  const yearRent = rent * 12;
  const vacancy = rent * Math.min(12, a.vacancy_months + extraVacancy);
  const collected = yearRent - vacancy;
  const community = (data.community_fee ?? a.community_default_eur * 100) * 12;
  const ibi = data.ibi ?? a.ibi_default_eur * 100;
  const insurance = a.home_insurance_eur * 100;
  const maintenance = yearRent * a.maintenance_pct * PCT;
  const management = collected * a.management_pct * PCT;
  const defaultInsurance = yearRent * a.default_insurance_pct * PCT;
  const total = vacancy + community + ibi + insurance + maintenance + management + defaultInsurance;
  return { vacancy, community, ibi, insurance, maintenance, management, defaultInsurance, total };
}

/** Análisis completo de una operación. Null si no hay renta estimada. */
export function analyze(facts: ListingFacts, a: Assumptions, opts: AnalyzeOptions = {}): Analysis | null {
  const scenarioValue = scenarioRent(facts.data, opts.scenario ?? "base");
  if (scenarioValue == null || scenarioValue <= 0) return null;

  const wanted = scenarioValue * (opts.rentFactor ?? 1);
  const cap = facts.data.rent_cap;
  const rentCapped = cap != null && cap > 0 && wanted > cap;
  const rent = rentCapped ? cap : wanted;

  const purchasePrice = opts.purchasePrice ?? facts.price;
  const ltvPct = opts.ltvPct ?? a.ltv_pct;
  const interestPct = a.interest_pct + (opts.rateDelta ?? 0);
  const fixed = fixedCosts(facts.data, a);

  const itp = purchasePrice * a.itp_pct * PCT;
  const purchaseCosts = purchasePrice * a.purchase_costs_pct * PCT + fixed.appraisal;
  const totalCost = purchasePrice + itp + purchaseCosts + fixed.reform + fixed.furnishing + fixed.setup;
  const loan = purchasePrice * ltvPct * PCT;
  const equity = totalCost - loan;
  const payment = monthlyPayment(loan, interestPct, a.term_years);

  const opex = operatingCosts(rent, facts.data, a, opts.extraVacancy);
  const noi = rent * 12 - opex.total;
  const cashflowYear = noi - payment * 12;

  return {
    purchasePrice,
    rent,
    rentCapped,
    itp,
    purchaseCosts,
    reform: fixed.reform,
    furnishing: fixed.furnishing,
    setup: fixed.setup,
    totalCost,
    ltvPct,
    loan,
    equity,
    payment,
    interestPct,
    opex,
    grossYield: (rent * 12) / purchasePrice,
    noi,
    netYield: noi / totalCost,
    cashflowYear,
    cashflowMonth: cashflowYear / 12,
    cashOnCash: equity > 0 ? cashflowYear / equity : null,
  };
}

/** Renta mensual necesaria para una rentabilidad bruta dada (en %). */
export const rentForGross = (price: number, grossPct: number) => (price * grossPct * PCT) / 12;

export interface MaxPrice {
  /** Por rentabilidad bruta mínima */
  byYield: number;
  /** Por capital propio máximo */
  byEquity: number;
  /** Para no tener cash flow negativo */
  byCashflow: number;
  /** El menor de los tres */
  max: number;
}

/** Precio máximo de compra compatible con los criterios, con la renta base. */
export function maxPrice(facts: ListingFacts, a: Assumptions, c: Criteria): MaxPrice | null {
  const base = analyze(facts, a);
  if (!base) return null;
  const fixed = fixedCosts(facts.data, a);

  const byYield = c.gross_min_pct > 0 ? (base.rent * 12) / (c.gross_min_pct * PCT) : Infinity;

  const perEuro = 1 + (a.itp_pct + a.purchase_costs_pct - a.ltv_pct) * PCT;
  const byEquity = perEuro > 0 ? Math.max(0, (c.max_equity_eur * 100 - fixed.total) / perEuro) : Infinity;

  // La cuota es proporcional al préstamo: cuota(P) = P · LTV · k
  const k = monthlyPayment(1_000_000, a.interest_pct, a.term_years) / 1_000_000;
  const byCashflow = base.noi <= 0 ? 0 : k > 0 && a.ltv_pct > 0 ? base.noi / (12 * a.ltv_pct * PCT * k) : Infinity;

  return { byYield, byEquity, byCashflow, max: Math.max(0, Math.min(byYield, byEquity, byCashflow)) };
}

export interface Sensitivity {
  label: string;
  analysis: Analysis;
}

/** Escenarios de estrés sobre la renta base al precio de compra. */
export function sensitivities(facts: ListingFacts, a: Assumptions, purchasePrice?: number): Sensitivity[] {
  const cases: [string, AnalyzeOptions][] = [
    ["Renta un 10 % más baja", { rentFactor: 0.9 }],
    ["Tipo de interés +1 punto", { rateDelta: 1 }],
    ["Dos meses más de vacancia", { extraVacancy: 2 }],
    ["Las tres a la vez", { rentFactor: 0.9, rateDelta: 1, extraVacancy: 2 }],
  ];
  return cases.flatMap(([label, opts]) => {
    const analysis = analyze(facts, a, { ...opts, purchasePrice });
    return analysis ? [{ label, analysis }] : [];
  });
}

/** Precio de compra a analizar: el objetivo si es menor que el anunciado. */
export function purchasePriceOf(facts: ListingFacts): number {
  const target = facts.data.target_price;
  return target != null && target > 0 && target < facts.price ? target : facts.price;
}

/** Diferencia del €/m² del anuncio con el de mercado (−0,1 = un 10 % más barato). */
export function priceVsMarket(facts: ListingFacts): number | null {
  const market = facts.data.market_price_sqm;
  if (!facts.sqm || !market) return null;
  return facts.price / facts.sqm / market - 1;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp01 = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));

export interface ScoreBreakdown {
  cashflow: number;
  net_yield: number;
  price: number;
  demand: number;
  appreciation: number;
  safety: number;
  total: number;
}

/**
 * Puntuación 0–100 con los pesos de los criterios.
 * Cash flow: 0 si es negativo, si no cash-on-cash de 0 % a 12 %. Neta: 2 % → 0, 6 % → máximo.
 * Precio: 10 % más caro que el mercado → 0, 15 % más barato → máximo. Lo que falta puntúa a medias.
 */
export function score(facts: ListingFacts, base: Analysis | null, c: Criteria): ScoreBreakdown {
  const s = facts.data.scores;
  const vsMarket = priceVsMarket(facts);
  const parts = {
    cashflow: !base ? 0 : base.cashflowYear < 0 ? 0 : lerp01(base.cashOnCash ?? 0, 0, 0.12),
    net_yield: base ? lerp01(base.netYield, 0.02, 0.06) : 0,
    price: vsMarket == null ? 0.5 : lerp01(-vsMarket, -0.1, 0.15),
    demand: (s.demand ?? 5) / 10,
    appreciation: (s.appreciation ?? 5) / 10,
    safety: (s.safety ?? 5) / 10,
  };
  const w = c.weights;
  const totalWeight = w.cashflow + w.net_yield + w.price + w.demand + w.appreciation + w.safety;
  const weighted = (Object.keys(parts) as (keyof typeof parts)[]).reduce((sum, k) => sum + parts[k] * w[k], 0);
  const total = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;
  const pts = (k: keyof typeof parts) => (totalWeight > 0 ? (parts[k] * w[k] * 100) / totalWeight : 0);
  return {
    cashflow: pts("cashflow"),
    net_yield: pts("net_yield"),
    price: pts("price"),
    demand: pts("demand"),
    appreciation: pts("appreciation"),
    safety: pts("safety"),
    total,
  };
}

export const VERDICTS = ["comprar", "negociar", "esperar", "investigar", "pendiente", "descartar"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABELS: Record<Verdict, string> = {
  comprar: "Comprar / negociar",
  negociar: "Negociar",
  esperar: "Esperar rebaja",
  investigar: "Investigar antes de ofertar",
  pendiente: "Pendiente de validar",
  descartar: "Descartar",
};

export interface Evaluation {
  purchasePrice: number;
  /** Renta base al precio de compra */
  base: Analysis | null;
  /** Renta base al precio anunciado */
  atAsking: Analysis | null;
  maxPrice: MaxPrice | null;
  /** Rebaja necesaria sobre el anunciado para llegar al precio máximo (0 si no hace falta) */
  discountNeeded: number | null;
  meetsCriteria: boolean;
  verdict: Verdict;
  reasons: string[];
  score: ScoreBreakdown;
}

const fmtPct = (v: number) => `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

function meets(an: Analysis | null, c: Criteria): boolean {
  return !!an && an.grossYield * 100 >= c.gross_min_pct && an.equity <= c.max_equity_eur * 100 && an.cashflowYear >= 0;
}

/** Evaluación completa: análisis base, precio máximo, veredicto y puntuación. */
export function evaluate(facts: ListingFacts, a: Assumptions, c: Criteria, confidence = "media"): Evaluation {
  const purchasePrice = purchasePriceOf(facts);
  const base = analyze(facts, a, { purchasePrice });
  const atAsking = purchasePrice === facts.price ? base : analyze(facts, a);
  const mp = maxPrice(facts, a, c);
  const discountNeeded = mp ? Math.max(0, facts.price - mp.max) : null;
  const sc = score(facts, base, c);
  const reasons: string[] = [];

  let verdict: Verdict;
  if (!base) {
    verdict = "pendiente";
    reasons.push("Falta una renta estimada con comparables.");
  } else {
    if (base.grossYield * 100 < c.gross_min_pct)
      reasons.push(`Rentabilidad bruta del ${fmtPct(base.grossYield)} (mínimo ${c.gross_min_pct} %).`);
    if (base.equity > c.max_equity_eur * 100) reasons.push("Necesita más capital propio del máximo.");
    if (base.cashflowYear < 0) reasons.push("Cash flow negativo.");
    if (base.rentCapped) reasons.push("La renta queda limitada por el tope legal.");

    const discountPct = discountNeeded != null ? discountNeeded / facts.price : 1;
    if (facts.price > c.price_exceptional_eur * 100 && !meets(base, c)) verdict = "descartar";
    else if (meets(atAsking, c) && facts.price <= c.price_max_eur * 100) verdict = "comprar";
    else if (meets(base, c) || discountPct <= 0.1) verdict = "negociar";
    else if (discountPct <= 0.2) verdict = "esperar";
    else verdict = "descartar";

    if (confidence === "baja" && (verdict === "comprar" || verdict === "negociar")) {
      verdict = "investigar";
      reasons.push("Confianza baja en los datos.");
    }
  }

  return {
    purchasePrice,
    base,
    atAsking,
    maxPrice: mp,
    discountNeeded,
    meetsCriteria: meets(base, c),
    verdict,
    reasons,
    score: sc,
  };
}

export interface PricePoint {
  price: number;
  seen_at: string;
}

/** Rebaja acumulada desde el primer precio visto (negativa si ha bajado). */
export function priceChange(history: PricePoint[], current: number): { amount: number; pct: number } | null {
  if (history.length === 0) return null;
  const first = [...history].sort((x, y) => x.seen_at.localeCompare(y.seen_at))[0].price;
  if (!first || first === current) return null;
  return { amount: current - first, pct: current / first - 1 };
}

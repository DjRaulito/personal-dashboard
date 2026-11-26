import { dayKey } from "@/lib/datetime";
import { evaluate, priceChange, type Evaluation, type ListingFacts, type PricePoint } from "./engine";
import {
  CONFIDENCES,
  LISTING_STATES,
  listingDataSchema,
  STATUSES,
  type Confidence,
  type ListingData,
  type ListingState,
  type PropertySettings,
  type Status,
} from "./schemas";

// De las filas de la base a lo que pintan las pantallas de Inmuebles.

export interface ListingRecord {
  id: string;
  url: string;
  source: string;
  title: string;
  municipality: string;
  neighborhood: string;
  price_cents: number;
  first_price_cents: number;
  sqm: number | null;
  rooms: number | null;
  confidence: string;
  listing_state: string;
  status: string;
  data: unknown;
  user_notes: string;
  discard_reason: string;
  first_seen_at: string;
  last_checked_at: string;
  removed_at: string | null;
  seen_at: string | null;
}

export interface Listing {
  id: string;
  url: string;
  source: string;
  title: string;
  municipality: string;
  neighborhood: string;
  price: number;
  sqm: number | null;
  rooms: number | null;
  confidence: Confidence;
  listingState: ListingState;
  status: Status;
  data: ListingData;
  userNotes: string;
  discardReason: string;
  firstSeenAt: string;
  lastCheckedAt: string;
  /** Ya abierto o marcado como leído */
  seen: boolean;
}

const oneOf = <T extends string>(values: readonly T[], v: string, fallback: T): T =>
  (values as readonly string[]).includes(v) ? (v as T) : fallback;

export function toListing(r: ListingRecord): Listing {
  return {
    id: r.id,
    url: r.url,
    source: r.source,
    title: r.title,
    municipality: r.municipality,
    neighborhood: r.neighborhood,
    price: Number(r.price_cents),
    sqm: r.sqm == null ? null : Number(r.sqm),
    rooms: r.rooms,
    confidence: oneOf(CONFIDENCES, r.confidence, "media"),
    listingState: oneOf(LISTING_STATES, r.listing_state, "desconocido"),
    status: oneOf(STATUSES, r.status, "nuevo"),
    data: listingDataSchema.parse(r.data ?? {}),
    userNotes: r.user_notes,
    discardReason: r.discard_reason,
    firstSeenAt: r.first_seen_at,
    lastCheckedAt: r.last_checked_at,
    seen: r.seen_at != null,
  };
}

export const factsOf = (l: Listing): ListingFacts => ({ price: l.price, sqm: l.sqm, data: l.data });

export interface EvaluatedListing extends Listing {
  ev: Evaluation;
  change: { amount: number; pct: number } | null;
  isNew: boolean;
}

export function evaluateListings(
  listings: Listing[],
  history: Map<string, PricePoint[]>,
  settings: PropertySettings,
  now: Date,
): EvaluatedListing[] {
  const today = dayKey(now);
  return listings
    .map((l) => ({
      ...l,
      ev: evaluate(factsOf(l), settings.assumptions, settings.criteria, l.confidence),
      change: priceChange(history.get(l.id) ?? [], l.price),
      isNew: dayKey(new Date(l.firstSeenAt)) === today,
    }))
    .sort((a, b) => rank(a) - rank(b) || b.ev.score.total - a.ev.score.total);
}

/** Primero los vivos y no descartados; los retirados y descartados al final. */
const rank = (l: EvaluatedListing) => (l.status === "descartado" ? 2 : l.listingState === "retirado" ? 1 : 0);

export interface RunInfo {
  ran_at: string;
  examined: number;
  saved: number;
  summary: string;
}

export interface Summary {
  active: number;
  newToday: number;
  priceDrops: number;
  meeting: number;
  /** ROI con apalancamiento ≥ oportunidad / entre opción y oportunidad (renta conservadora) */
  opportunities: number;
  options: number;
  best: EvaluatedListing | null;
  bestCashflow: EvaluatedListing | null;
  bestRoi: EvaluatedListing | null;
  lastRun: RunInfo | null;
}

const live = (l: EvaluatedListing) => l.listingState !== "retirado" && l.status !== "descartado";

function bestBy(list: EvaluatedListing[], key: (l: EvaluatedListing) => number | null): EvaluatedListing | null {
  let best: EvaluatedListing | null = null;
  let bestValue = -Infinity;
  for (const l of list) {
    const v = key(l);
    if (v != null && v > bestValue) {
      best = l;
      bestValue = v;
    }
  }
  return best;
}

export function summarize(list: EvaluatedListing[], runs: RunInfo[]): Summary {
  const alive = list.filter(live);
  const withData = alive.filter((l) => l.ev.conservative);
  return {
    active: alive.length,
    newToday: alive.filter((l) => l.isNew).length,
    priceDrops: alive.filter((l) => l.change && l.change.amount < 0).length,
    meeting: alive.filter((l) => l.ev.meetsCriteria).length,
    opportunities: alive.filter((l) => l.ev.roiClass === "oportunidad").length,
    options: alive.filter((l) => l.ev.roiClass === "opcion").length,
    best: bestBy(withData, (l) => l.ev.score.total),
    bestCashflow: bestBy(withData, (l) => l.ev.conservative!.cashflowYear),
    bestRoi: bestBy(withData, (l) => l.ev.conservative!.leveragedRoi),
    lastRun: runs[0] ?? null,
  };
}

export interface ListingFilters {
  status: Status | "activos" | "todos";
  municipality: string;
  onlyMeeting: boolean;
}

export function parseFilters(sp: { estado?: string; municipio?: string; cumple?: string }): ListingFilters {
  const status = sp.estado ?? "activos";
  return {
    status: status === "todos" || (STATUSES as readonly string[]).includes(status) ? (status as Status) : "activos",
    municipality: (sp.municipio ?? "").slice(0, 80),
    onlyMeeting: sp.cumple === "1",
  };
}

export function filterListings(list: EvaluatedListing[], f: ListingFilters): EvaluatedListing[] {
  return list.filter(
    (l) =>
      (f.status === "todos" || (f.status === "activos" ? live(l) : l.status === f.status)) &&
      (!f.municipality || l.municipality === f.municipality) &&
      (!f.onlyMeeting || l.ev.meetsCriteria),
  );
}

export function municipalities(list: Listing[]): string[] {
  return [...new Set(list.map((l) => l.municipality))].sort((a, b) => a.localeCompare(b, "es"));
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PricePoint } from "./engine";
import { settingsSchema, type PropertySettings } from "./schemas";
import { toListing, type Listing, type RunInfo } from "./view";

const LISTING_COLUMNS =
  "id, url, source, title, municipality, neighborhood, price_cents, first_price_cents, sqm, rooms, confidence, listing_state, status, data, user_notes, discard_reason, first_seen_at, last_checked_at, removed_at";

export async function getPropertySettings(): Promise<PropertySettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("property_settings").select("assumptions, criteria").maybeSingle();
  return settingsSchema.parse(data ?? {});
}

function groupHistory(rows: { listing_id: string; price_cents: number; seen_at: string }[]) {
  const map = new Map<string, PricePoint[]>();
  for (const r of rows) {
    const list = map.get(r.listing_id) ?? [];
    list.push({ price: Number(r.price_cents), seen_at: r.seen_at });
    map.set(r.listing_id, list);
  }
  return map;
}

export interface PropertyData {
  listings: Listing[];
  history: Map<string, PricePoint[]>;
  runs: RunInfo[];
  settings: PropertySettings;
}

export async function getProperties(): Promise<PropertyData> {
  const supabase = await createClient();
  const [listings, history, runs, settings] = await Promise.all([
    supabase.from("property_listings").select(LISTING_COLUMNS).order("first_seen_at", { ascending: false }).limit(1000),
    supabase.from("property_price_history").select("listing_id, price_cents, seen_at").order("seen_at").limit(5000),
    supabase
      .from("property_runs")
      .select("ran_at, examined, saved, summary")
      .order("ran_at", { ascending: false })
      .limit(10),
    getPropertySettings(),
  ]);
  if (listings.error) throw listings.error;
  return {
    listings: (listings.data ?? []).map(toListing),
    history: groupHistory(history.data ?? []),
    runs: runs.data ?? [],
    settings,
  };
}

export async function getProperty(id: string) {
  const supabase = await createClient();
  const [listing, history, settings] = await Promise.all([
    supabase.from("property_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("property_price_history")
      .select("listing_id, price_cents, seen_at")
      .eq("listing_id", id)
      .order("seen_at"),
    getPropertySettings(),
  ]);
  if (!listing.data) return null;
  return {
    listing: toListing(listing.data),
    history: groupHistory(history.data ?? []).get(id) ?? [],
    settings,
  };
}

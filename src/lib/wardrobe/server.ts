import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Weather } from "./ai";
import { detailsFromFamilies, PATTERNS, type ColorDetail, type Pattern } from "./colors";
import type { Category, Garment, GarmentColor, Occasion, Outfit } from "./types";

export const WARDROBE_BUCKET = "wardrobe";
// Las fotos se sirven con enlaces firmados que caducan
const SIGNED_URL_SECONDS = 2 * 3600;

/** Prendas del armario con un enlace temporal a su foto, de la más nueva a la más vieja. */
export async function getGarments(): Promise<Garment[]> {
  const supabase = await createClient();
  const [{ data }, { data: wears }] = await Promise.all([
    supabase
      .from("wardrobe_garments")
      .select(
        "id, name, category, colors, color_details, pattern, fabric, formality, needs_review, warmth, occasions, cutout, image_path",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("wardrobe_wears").select("garment_id, worn_on").order("worn_on", { ascending: false }).limit(2000),
  ]);
  const lastWorn = new Map<string, string>();
  for (const w of wears ?? []) if (!lastWorn.has(w.garment_id)) lastWorn.set(w.garment_id, w.worn_on);
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage.from(WARDROBE_BUCKET).createSignedUrls(
    rows.map((r) => r.image_path),
    SIGNED_URL_SECONDS,
  );
  const urls = new Map((signed ?? []).filter((s) => !s.error && s.path).map((s) => [s.path!, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as Category,
    colors: r.colors as GarmentColor[],
    colorDetails:
      Array.isArray(r.color_details) && r.color_details.length
        ? (r.color_details as unknown as ColorDetail[])
        : detailsFromFamilies(r.colors as GarmentColor[]),
    pattern: (PATTERNS as readonly string[]).includes(r.pattern) ? (r.pattern as Pattern) : "plain",
    fabric: r.fabric,
    formality: r.formality,
    needsReview: r.needs_review,
    lastWorn: lastWorn.get(r.id) ?? null,
    warmth: r.warmth,
    occasions: r.occasions as Occasion[],
    cutout: r.cutout,
    url: urls.get(r.image_path) ?? null,
  }));
}

export async function getOutfits(): Promise<Outfit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wardrobe_outfits")
    .select("id, name, occasion, note, favorite, wardrobe_outfit_items(garment_id)")
    .order("favorite", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    occasion: o.occasion as Occasion | null,
    note: o.note,
    favorite: o.favorite,
    garmentIds: o.wardrobe_outfit_items.map((i) => i.garment_id),
  }));
}

export interface WardrobeSettings {
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function getWardrobeSettings(): Promise<WardrobeSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("wardrobe_settings").select("city, latitude, longitude").maybeSingle();
  return { city: data?.city ?? null, latitude: data?.latitude ?? null, longitude: data?.longitude ?? null };
}

// ---------------------------------------------------------------------------
// El tiempo (Open-Meteo: gratis y sin clave)
// ---------------------------------------------------------------------------

/** Busca una ciudad por su nombre; null si no existe. */
export async function geocodeCity(name: string): Promise<{ city: string; latitude: number; longitude: number } | null> {
  const params = new URLSearchParams({ name, count: "1", language: "es", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as {
    results?: { name?: string; admin1?: string; country?: string; latitude?: number; longitude?: number }[];
  };
  const hit = data.results?.[0];
  if (!hit?.name || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") return null;
  const label = [hit.name, hit.admin1 !== hit.name ? hit.admin1 : null, hit.country].filter(Boolean).join(", ");
  return { city: label.slice(0, 80), latitude: hit.latitude, longitude: hit.longitude };
}

/** Mínima, máxima y probabilidad de lluvia de hoy; null si no hay ciudad o el servicio falla. */
export async function getTodayWeather(settings: WardrobeSettings): Promise<Weather | null> {
  if (settings.latitude === null || settings.longitude === null) return null;
  const params = new URLSearchParams({
    latitude: String(settings.latitude),
    longitude: String(settings.longitude),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Europe/Madrid",
    forecast_days: "1",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      daily?: {
        temperature_2m_max?: (number | null)[];
        temperature_2m_min?: (number | null)[];
        precipitation_probability_max?: (number | null)[];
      };
    };
    const max = data.daily?.temperature_2m_max?.[0];
    const min = data.daily?.temperature_2m_min?.[0];
    if (typeof max !== "number" || typeof min !== "number") return null;
    return { min, max, rain: data.daily?.precipitation_probability_max?.[0] ?? 0 };
  } catch {
    return null;
  }
}

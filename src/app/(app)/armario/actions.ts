"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { imageSchema } from "@/lib/ai/image";
import { askJson } from "@/lib/ai/llm";
import { runAi, type AiResult } from "@/lib/ai/result";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { createClient } from "@/lib/supabase/server";
import {
  garmentTagSchema,
  outfitPrompt,
  outfitSuggestionSchema,
  resolveOutfits,
  SYSTEM_WARDROBE,
  TAG_PROMPT,
  type GarmentTags,
  type ResolvedOutfit,
} from "@/lib/wardrobe/ai";
import { geocodeCity, getGarments, getTodayWeather, getWardrobeSettings, WARDROBE_BUCKET } from "@/lib/wardrobe/server";
import { CATEGORIES, COLORS, MAX_ACCESSORIES, OCCASIONS, lookFrom, lookIds } from "@/lib/wardrobe/types";

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/armario", "layout");
}

const uuid = z.uuid();

const garmentFields = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(80, "Máximo 80 caracteres"),
  category: z.enum(CATEGORIES, "Elige una categoría"),
  colors: z.array(z.enum(COLORS)).max(4, "Como mucho 4 colores"),
  warmth: z.coerce.number().int().min(1).max(3),
  occasions: z.array(z.enum(OCCASIONS)),
});

const readGarment = (formData: FormData) =>
  garmentFields.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    colors: formData.getAll("colors"),
    warmth: formData.get("warmth") ?? "2",
    occasions: formData.getAll("occasions"),
  });

// ---------------------------------------------------------------------------
// Prendas
// ---------------------------------------------------------------------------

/** La IA mira la foto y propone nombre, categoría, colores… (el usuario lo revisa antes de guardar). */
export async function tagGarment(image: unknown): Promise<AiResult<GarmentTags>> {
  const parsed = imageSchema.safeParse(image);
  if (!parsed.success) return { ok: false, message: "Foto no válida." };
  await session();
  return runAi(() => askJson(garmentTagSchema, SYSTEM_WARDROBE, TAG_PROMPT, parsed.data));
}

/** Guarda una prenda cuya foto ya se ha subido al bucket desde el navegador. */
export async function createGarment(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = readGarment(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { supabase, user } = await session();
  const path = String(formData.get("image_path") ?? "");
  // La foto tiene que estar en la carpeta del usuario
  if (!new RegExp(`^${user.id}/[a-f0-9-]{36}\\.(webp|png|jpg)$`).test(path)) {
    return { ok: false, message: "Falta la foto de la prenda." };
  }
  const { error } = await supabase.from("wardrobe_garments").insert({
    ...parsed.data,
    image_path: path,
    cutout: formData.get("cutout") === "1",
  });
  if (error) {
    await supabase.storage.from(WARDROBE_BUCKET).remove([path]);
    return { ok: false, message: "No se pudo guardar la prenda." };
  }
  refresh();
  return { ok: true, message: "Prenda guardada." };
}

export async function updateGarment(_: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("id"));
  const parsed = readGarment(formData);
  if (!id.success) return { ok: false, message: "Prenda no válida." };
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { supabase } = await session();
  const { error } = await supabase.from("wardrobe_garments").update(parsed.data).eq("id", id.data);
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: "Guardado." };
}

export async function deleteGarment(id: string): Promise<{ ok: boolean }> {
  const garmentId = uuid.parse(id);
  const { supabase } = await session();
  const { data } = await supabase.from("wardrobe_garments").delete().eq("id", garmentId).select("image_path");
  const paths = (data ?? []).map((r) => r.image_path);
  if (paths.length) await supabase.storage.from(WARDROBE_BUCKET).remove(paths);
  refresh();
  return { ok: paths.length > 0 };
}

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------

const outfitInput = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(80),
  occasion: z.enum(OCCASIONS).nullable(),
  note: z.string().trim().max(300).nullable(),
  garmentIds: z
    .array(uuid)
    .min(2, "Elige al menos dos prendas")
    .max(4 + MAX_ACCESSORIES),
});

export async function saveOutfit(input: unknown): Promise<FormState> {
  const parsed = outfitInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Outfit no válido." };
  const { supabase } = await session();
  // Solo prendas propias, y una por zona
  const ids = lookIds(lookFrom(parsed.data.garmentIds, await getGarments()));
  if (ids.length < 2) return { ok: false, message: "Elige al menos dos prendas." };
  const { data: outfit, error } = await supabase
    .from("wardrobe_outfits")
    .insert({ name: parsed.data.name, occasion: parsed.data.occasion, note: parsed.data.note || null })
    .select("id")
    .single();
  if (error || !outfit) return { ok: false, message: "No se pudo guardar el outfit." };
  const { error: itemsError } = await supabase
    .from("wardrobe_outfit_items")
    .insert(ids.map((garment_id) => ({ outfit_id: outfit.id, garment_id })));
  if (itemsError) {
    await supabase.from("wardrobe_outfits").delete().eq("id", outfit.id);
    return { ok: false, message: "No se pudo guardar el outfit." };
  }
  refresh();
  return { ok: true, message: "Outfit guardado." };
}

export async function deleteOutfit(id: string): Promise<void> {
  const outfitId = uuid.parse(id);
  const { supabase } = await session();
  await supabase.from("wardrobe_outfits").delete().eq("id", outfitId);
  refresh();
}

const suggestInput = z.object({
  occasion: z.enum(OCCASIONS).nullable(),
  pinId: uuid.nullable(),
  wishes: z.string().max(200),
  useWeather: z.boolean(),
});

/** La IA propone hasta tres conjuntos con las prendas del armario. */
export async function suggestOutfits(input: unknown): Promise<AiResult<ResolvedOutfit[]>> {
  const parsed = suggestInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Petición no válida." };
  await session();
  const garments = await getGarments();
  const needs = (["top", "bottom"] as const).filter((c) => !garments.some((g) => g.category === c));
  if (needs.length) {
    return { ok: false, message: "Para generar outfits hace falta al menos una parte de arriba y un pantalón." };
  }
  const weather = parsed.data.useWeather ? await getTodayWeather(await getWardrobeSettings()) : null;
  return runAi(async () => {
    const request = { ...parsed.data, weather };
    const suggestion = await askJson(outfitSuggestionSchema, SYSTEM_WARDROBE, outfitPrompt(garments, request));
    const outfits = resolveOutfits(suggestion, garments, parsed.data.pinId);
    if (outfits.length === 0) throw new Error("La IA no devolvió conjuntos válidos. Vuelve a intentarlo.");
    return outfits;
  });
}

// ---------------------------------------------------------------------------
// Ajustes: ciudad para el tiempo
// ---------------------------------------------------------------------------

export async function saveCity(_: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("city") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, errors: { city: "Escribe el nombre de tu ciudad." } };
  const { supabase } = await session();
  let place: Awaited<ReturnType<typeof geocodeCity>>;
  try {
    place = await geocodeCity(name);
  } catch {
    return { ok: false, message: "No se pudo consultar el servicio del tiempo. Inténtalo luego." };
  }
  if (!place) return { ok: false, errors: { city: "No encuentro esa ciudad." } };
  const { error } = await supabase.from("wardrobe_settings").upsert(place, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo guardar." };
  refresh();
  return { ok: true, message: `Ciudad guardada: ${place.city}.` };
}

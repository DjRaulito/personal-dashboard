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
  colorDetailSchema,
  combineGarmentsPrompt,
  combinePhotoPrompt,
  combineSchema,
  garmentTagSchema,
  outfitPrompt,
  outfitSuggestionSchema,
  resolveOutfits,
  SYSTEM_WARDROBE,
  TAG_PROMPT,
  type CombineResult,
  type GarmentTags,
  type ResolvedOutfit,
} from "@/lib/wardrobe/ai";
import { PATTERNS } from "@/lib/wardrobe/colors";
import { geocodeCity, getGarments, getTodayWeather, getWardrobeSettings, WARDROBE_BUCKET } from "@/lib/wardrobe/server";
import { CATEGORIES, MAX_ACCESSORIES, OCCASIONS, lookFrom, lookIds } from "@/lib/wardrobe/types";
import { dayKey } from "@/lib/datetime";
import { addDays } from "@/lib/investments/engine";

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
  revalidatePath("/ajustes/armario");
}

const uuid = z.uuid();

const garmentFields = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(80, "Máximo 80 caracteres"),
  category: z.enum(CATEGORIES, "Elige una categoría"),
  color_details: z.array(colorDetailSchema).max(4, "Como mucho 4 colores"),
  pattern: z.enum(PATTERNS).catch("plain"),
  fabric: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || null),
  formality: z.coerce.number().int().min(1).max(5).catch(2),
  warmth: z.coerce.number().int().min(1).max(3),
  occasions: z.array(z.enum(OCCASIONS)),
  needs_review: z.boolean(),
});

const jsonList = (v: FormDataEntryValue | null): unknown => {
  try {
    return JSON.parse(String(v ?? "[]"));
  } catch {
    return [];
  }
};

/** Los colores llegan como JSON (nombre, familia, tono y hex); la familia también va en `colors`. */
const readGarment = (formData: FormData) => {
  const parsed = garmentFields.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    color_details: jsonList(formData.get("color_details")),
    pattern: formData.get("pattern") ?? "plain",
    fabric: formData.get("fabric") ?? "",
    formality: formData.get("formality") ?? "2",
    warmth: formData.get("warmth") ?? "2",
    occasions: formData.getAll("occasions"),
    needs_review: formData.get("needs_review") === "1",
  });
  if (!parsed.success) return parsed;
  return {
    ...parsed,
    data: { ...parsed.data, colors: [...new Set(parsed.data.color_details.map((c) => c.family))] },
  };
};

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

/** Cambia la foto de una prenda (p. ej. tras retocar el recorte) y borra la anterior. */
export async function replaceGarmentImage(id: string, path: string): Promise<{ ok: boolean; message?: string }> {
  const garmentId = uuid.safeParse(id);
  if (!garmentId.success) return { ok: false, message: "Prenda no válida." };
  const { supabase, user } = await session();
  if (!new RegExp(`^${user.id}/[a-f0-9-]{36}\\.(webp|png|jpg)$`).test(path)) {
    return { ok: false, message: "Foto no válida." };
  }
  const { data: before } = await supabase
    .from("wardrobe_garments")
    .select("image_path")
    .eq("id", garmentId.data)
    .maybeSingle();
  if (!before) return { ok: false, message: "Prenda no encontrada." };
  const { error } = await supabase
    .from("wardrobe_garments")
    .update({ image_path: path, cutout: true })
    .eq("id", garmentId.data);
  if (error) {
    await supabase.storage.from(WARDROBE_BUCKET).remove([path]);
    return { ok: false, message: "No se pudo guardar la foto." };
  }
  if (before.image_path !== path) await supabase.storage.from(WARDROBE_BUCKET).remove([before.image_path]);
  refresh();
  return { ok: true };
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
  plan: z.string().trim().max(200),
  pinId: uuid.nullable(),
  useWeather: z.boolean(),
});

/** ¿Qué me pongo? La IA propone hasta tres conjuntos y las reglas de color los filtran. */
export async function suggestOutfits(input: unknown): Promise<AiResult<ResolvedOutfit[]>> {
  const parsed = suggestInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Petición no válida." };
  await session();
  const garments = await getGarments();
  const needs = (["top", "bottom"] as const).filter((c) => !garments.some((g) => g.category === c));
  if (needs.length) {
    return { ok: false, message: "Para proponer outfits hace falta al menos una parte de arriba y un pantalón." };
  }
  const weather = parsed.data.useWeather ? await getTodayWeather(await getWardrobeSettings()) : null;
  const since = addDays(dayKey(new Date()), -5);
  const recentIds = garments.filter((g) => g.lastWorn && g.lastWorn >= since).map((g) => g.id);
  return runAi(async () => {
    const request = { ...parsed.data, weather, recentIds };
    const suggestion = await askJson(outfitSuggestionSchema, SYSTEM_WARDROBE, outfitPrompt(garments, request));
    const outfits = resolveOutfits(suggestion, garments, parsed.data.pinId);
    if (outfits.length === 0)
      throw new Error("La IA no propuso conjuntos que pasen las reglas de color. Vuelve a intentarlo.");
    return outfits;
  });
}

/** «Me lo pongo»: apunta las prendas de hoy (sirve para no repetir). */
export async function wearToday(ids: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = z.array(uuid).min(1).max(8).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "Elige alguna prenda." };
  const { supabase } = await session();
  const today = dayKey(new Date());
  const { error } = await supabase.from("wardrobe_wears").upsert(
    parsed.data.map((garment_id) => ({ garment_id, worn_on: today })),
    { onConflict: "user_id,garment_id,worn_on", ignoreDuplicates: true },
  );
  if (error) return { ok: false, message: "No se pudo apuntar." };
  refresh();
  return { ok: true, message: "Apuntado: hoy llevas esto." };
}

export async function toggleFavorite(id: string, favorite: boolean): Promise<void> {
  const outfitId = uuid.parse(id);
  const { supabase } = await session();
  await supabase.from("wardrobe_outfits").update({ favorite }).eq("id", outfitId);
  refresh();
}

/** ¿Combina? con prendas del armario: reglas fijas + la IA nombra los colores y propone un arreglo. */
export async function combineGarments(ids: unknown): Promise<AiResult<CombineResult>> {
  const parsed = z.array(uuid).min(2, "Elige al menos dos prendas.").max(6).safeParse(ids);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Elige al menos dos prendas." };
  await session();
  const garments = await getGarments();
  const selected = parsed.data.map((id) => garments.find((g) => g.id === id)).filter((g) => !!g);
  if (selected.length < 2) return { ok: false, message: "Elige al menos dos prendas." };
  return runAi(() => askJson(combineSchema, SYSTEM_WARDROBE, combineGarmentsPrompt(selected, garments)));
}

/** ¿Combina? con una foto de lo que llevas puesto. */
export async function combinePhoto(image: unknown): Promise<AiResult<CombineResult>> {
  const parsed = imageSchema.safeParse(image);
  if (!parsed.success) return { ok: false, message: "Foto no válida." };
  await session();
  const garments = await getGarments();
  return runAi(() => askJson(combineSchema, SYSTEM_WARDROBE, combinePhotoPrompt(garments), parsed.data));
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

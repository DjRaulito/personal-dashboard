"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { hashToken } from "@/lib/brain/schemas";
import { contentSession } from "@/lib/content/server";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { settingsSchema } from "@/lib/studio/catalog";
import { setRepoSecret, studioGithubConfigured } from "@/lib/studio/github";
import { refresh } from "./shared";

// Acciones de los ajustes del estudio: voz, piloto automático, claves de los montadores y muestra de voz.

export async function saveStudioSettings(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(formData),
    autopilot_days: formData.getAll("autopilot_days"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await contentSession();
  if (parsed.data.autopilot && parsed.data.autopilot_days.length === 0)
    return { ok: false, errors: { autopilot_days: "Elige al menos un día" } };
  const { error } = await supabase.from("studio_settings").upsert(parsed.data, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudieron guardar los ajustes." };
  refresh();
  return { ok: true, message: "Ajustes guardados." };
}

export interface KeyResult {
  ok: boolean;
  message: string;
  /** Solo si no se pudo guardar sola en GitHub: hay que copiarla a mano (se muestra una vez). */
  token?: string;
}

/**
 * Crea la clave del estudio (la base de datos guarda solo su huella) y la guarda como secreto del
 * repo (STUDIO_WORKER_TOKEN) junto a la dirección de la app (STUDIO_APP_URL) para el piloto automático.
 */
export async function createWorkerKey(): Promise<KeyResult> {
  const supabase = await contentSession();
  const token = `studio_${randomBytes(32).toString("base64url")}`;
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ worker_token_hash: hashToken(token) }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo crear la clave." };
  refresh();

  if (!studioGithubConfigured()) {
    return { ok: true, token, message: "Cópiala en GitHub: falta GITHUB_AGENT_TOKEN para guardarla sola." };
  }
  try {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    await setRepoSecret("STUDIO_WORKER_TOKEN", token);
    await setRepoSecret("STUDIO_APP_URL", origin);
    return { ok: true, message: "Clave creada y guardada en GitHub. Ya está todo listo." };
  } catch {
    return {
      ok: true,
      token,
      message:
        "La clave está creada, pero GitHub no dejó guardarla (el token necesita el permiso «Secrets»). Cópiala a mano.",
    };
  }
}

/**
 * Crea la clave del estudio local (tu PC). Se muestra una sola vez: va en `.env.local` como
 * STUDIO_LOCAL_TOKEN. La base de datos guarda solo su huella; la de GitHub no cambia.
 */
export async function createLocalWorkerKey(): Promise<KeyResult> {
  const supabase = await contentSession();
  const token = `studio_pc_${randomBytes(32).toString("base64url")}`;
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ local_token_hash: hashToken(token) }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo crear la clave." };
  refresh();
  return { ok: true, token, message: "Clave creada. Cópiala ahora: no se vuelve a mostrar." };
}

const SAMPLE_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/x-m4a",
];

export async function saveVoiceSample(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const file = formData.get("sample");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "No llegó ningún audio." };
  if (file.size > 3 * 1024 * 1024)
    return { ok: false, message: "La muestra pesa más de 3 MB: usa una de 1 minuto como mucho." };
  const mime = file.type.split(";")[0] || "audio/webm";
  if (!SAMPLE_TYPES.includes(mime)) return { ok: false, message: "Formato de audio no admitido." };
  const hex = Buffer.from(await file.arrayBuffer()).toString("hex");
  const supabase = await contentSession();
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ voice_sample: `\\x${hex}`, voice_sample_mime: mime }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo guardar la muestra." };
  refresh();
  return { ok: true, message: "Muestra guardada. Ya puedes usar tu voz en los vídeos." };
}

export async function deleteVoiceSample(): Promise<void> {
  const supabase = await contentSession();
  await supabase
    .from("studio_settings")
    .update({ voice_sample: null, voice_sample_mime: null, autopilot_voice: "ai" })
    .not("user_id", "is", null);
  refresh();
}

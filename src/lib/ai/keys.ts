import "server-only";
import { decryptToken } from "@/lib/crypto";
import { encryptionKey } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { AI_PROVIDERS, PROVIDER_INFO, type AiKeys, type ProviderId } from "./providers";

/** Claves de las variables de entorno (las del servidor). */
export function serverAiKeys(): AiKeys {
  const out: AiKeys = {};
  for (const id of AI_PROVIDERS) {
    const value = process.env[PROVIDER_INFO[id].env];
    if (value) out[id] = value;
  }
  return out;
}

/**
 * Claves de IA del usuario actual: las suyas (Ajustes → Conexiones) primero. Las del servidor solo
 * las usan los administradores, para que otros usuarios no gasten su cuota gratuita.
 */
export async function loadAiKeys(): Promise<AiKeys> {
  try {
    const supabase = await createClient();
    const [{ data: rows }, { data: admin }] = await Promise.all([
      supabase.from("user_api_keys").select("provider, encrypted_key"),
      supabase.rpc("is_admin"),
    ]);
    const key = encryptionKey();
    const own: AiKeys = {};
    for (const r of rows ?? []) {
      if (!key || !(AI_PROVIDERS as readonly string[]).includes(r.provider)) continue;
      try {
        own[r.provider as ProviderId] = decryptToken(r.encrypted_key, key);
      } catch {
        // clave ilegible (cambió TOKEN_ENCRYPTION_KEY): se ignora
      }
    }
    return admin ? { ...serverAiKeys(), ...own } : own;
  } catch {
    // Sin sesión (tareas internas): las del servidor
    return serverAiKeys();
  }
}

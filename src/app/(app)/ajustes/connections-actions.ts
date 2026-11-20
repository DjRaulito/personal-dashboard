"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AI_PROVIDERS, keyHint, PROVIDER_INFO } from "@/lib/ai/providers";
import { encryptToken } from "@/lib/crypto";
import { encryptionKey } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export interface KeyState {
  ok: boolean;
  message?: string;
}

const keyInput = z.object({
  provider: z.enum(AI_PROVIDERS),
  key: z
    .string()
    .trim()
    .min(16, "La clave parece demasiado corta")
    .max(400)
    .regex(/^[\w\-.:]+$/, "La clave tiene caracteres raros: cópiala de nuevo"),
});

/** Guarda (o sustituye) la clave de un proveedor de IA, cifrada. */
export async function saveAiKey(_: KeyState, formData: FormData): Promise<KeyState> {
  const parsed = keyInput.safeParse({ provider: formData.get("provider"), key: formData.get("key") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const secret = encryptionKey();
  if (!secret) return { ok: false, message: "Falta TOKEN_ENCRYPTION_KEY en el servidor." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vuelve a iniciar sesión." };

  const { provider, key } = parsed.data;
  const { error } = await supabase
    .from("user_api_keys")
    .upsert(
      { user_id: user.id, provider, encrypted_key: encryptToken(key, secret), hint: keyHint(key) },
      { onConflict: "user_id,provider" },
    );
  if (error) return { ok: false, message: "No se pudo guardar la clave." };
  revalidatePath("/ajustes/conexiones");
  return { ok: true, message: `Clave de ${PROVIDER_INFO[provider].label} guardada.` };
}

export async function deleteAiKey(provider: string) {
  const id = z.enum(AI_PROVIDERS).parse(provider);
  const supabase = await createClient();
  await supabase.from("user_api_keys").delete().eq("provider", id);
  revalidatePath("/ajustes/conexiones");
}

/** Quita la conexión con Google (el refresh token guardado). */
export async function disconnectGoogle() {
  const supabase = await createClient();
  await supabase.from("integrations").delete().eq("provider", "google");
  revalidatePath("/ajustes/conexiones");
}

// ---------------------------------------------------------------------------
// Invitaciones (solo administradores; la BD lo comprueba)
// ---------------------------------------------------------------------------

export async function addInvite(_: KeyState, formData: FormData): Promise<KeyState> {
  const email = z.email("Email no válido").safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!email.success) return { ok: false, message: "Email no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_invite", { p_email: email.data });
  if (error)
    return {
      ok: false,
      message: error.message.includes("administradores") ? "Solo para administradores." : "No se pudo invitar.",
    };
  revalidatePath("/ajustes/usuarios");
  return { ok: true, message: `${email.data} ya puede entrar con su cuenta de Google.` };
}

export async function removeInvite(email: string) {
  const supabase = await createClient();
  await supabase.rpc("remove_invite", { p_email: z.email().parse(email) });
  revalidatePath("/ajustes/usuarios");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { memoryFormSchema, newToken } from "@/lib/brain/schemas";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return supabase;
}

const PAGE = "/ia/cerebro";
const id = z.uuid();

export interface SaveMemoryState extends FormState {
  /** Id del recuerdo guardado, para seleccionarlo en la red */
  savedId?: string;
}

export async function saveMemory(_: SaveMemoryState, formData: FormData): Promise<SaveMemoryState> {
  const parsed = memoryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await session();
  const { id: memoryId, ...values } = parsed.data;
  const query = memoryId
    ? supabase.from("brain_memories").update(values).eq("id", memoryId)
    : supabase.from("brain_memories").insert({ ...values, source: "manual" });
  const { data, error } = await query.select("id").single();
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Ya tienes un recuerdo con ese título." : "No se pudo guardar el recuerdo.",
    };
  }
  revalidatePath(PAGE);
  return { ok: true, message: "Guardado", savedId: data.id };
}

export async function deleteMemory(memoryId: string) {
  const supabase = await session();
  await supabase.from("brain_memories").delete().eq("id", id.parse(memoryId));
  revalidatePath(PAGE);
}

/** Conecta o desconecta dos recuerdos a mano. */
export async function setLink(first: string, second: string, connect: boolean) {
  const [a, b] = [id.parse(first), id.parse(second)].sort();
  if (a === b) return;
  const supabase = await session();
  if (connect) await supabase.from("brain_links").upsert({ a, b }, { onConflict: "a,b", ignoreDuplicates: true });
  else await supabase.from("brain_links").delete().eq("a", a).eq("b", b);
  revalidatePath(PAGE);
}

/** Borra toda la memoria de golpe (los tokens se conservan). */
export async function forgetAll() {
  const supabase = await session();
  await supabase.from("brain_memories").delete().not("id", "is", null);
  revalidatePath(PAGE);
}

export interface TokenState extends FormState {
  /** El token en claro: solo se ve ahora, después únicamente queda su hash */
  token?: string;
}

export async function createToken(_: TokenState, formData: FormData): Promise<TokenState> {
  const label = z
    .string()
    .trim()
    .max(60)
    .catch("")
    .parse(formData.get("label") ?? "");
  const supabase = await session();
  const { token, hash } = newToken();
  const { error } = await supabase.from("brain_tokens").insert({ label, token_hash: hash });
  if (error) return { ok: false, message: "No se pudo crear el token." };
  revalidatePath(PAGE);
  return { ok: true, token };
}

export async function revokeToken(tokenId: string) {
  const supabase = await session();
  await supabase.from("brain_tokens").delete().eq("id", id.parse(tokenId));
  revalidatePath(PAGE);
}

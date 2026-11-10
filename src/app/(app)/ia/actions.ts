"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assistantSystem } from "@/lib/ai/assistant";
import { chatWithTools, type ChatResult } from "@/lib/ai/llm";
import { runAi, type AiResult } from "@/lib/ai/result";
import { assistantTools } from "@/lib/ai/tools";
import { dayKey } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

const turnsSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(4000) }))
  .min(1)
  .max(30)
  .refine((t) => t.at(-1)?.role === "user", "El último mensaje debe ser tuyo");

export async function askAssistant(turns: unknown): Promise<AiResult<ChatResult>> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const parsed = turnsSchema.safeParse(turns);
  if (!parsed.success) return { ok: false, message: "Escribe una pregunta (máx. 4.000 caracteres)." };
  const now = new Date();
  const today = dayKey(now);
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" }).format(now);
  // Solo los últimos turnos: suficiente contexto sin gastar la cuota gratuita
  return runAi(() => chatWithTools(assistantSystem(today, weekday), parsed.data.slice(-12), assistantTools(today)));
}

import "server-only";
import { AiUnavailableError } from "./llm";

export type AiResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** Ejecuta una llamada a la IA y convierte los errores en un mensaje para la interfaz. */
export async function runAi<T>(fn: () => Promise<T>): Promise<AiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AiUnavailableError) return { ok: false, message: e.message };
    console.error("[ia]", e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : "La IA no está disponible ahora." };
  }
}

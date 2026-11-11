import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contentSession } from "@/lib/content/server";
import { GoogleAuthError, DRIVE_FILE_SCOPE } from "@/lib/google/calendar";
import { getGoogleAccess } from "@/lib/google/server";
import { studioGithubConfigured } from "@/lib/studio/github";

// Piezas comunes de las acciones del estudio de vídeo (vídeos y ajustes).

export const jobIdSchema = z.uuid();
export const STUDIO = "/contenido/estudio";

/** Refresca las pantallas del estudio (y la del vídeo si se indica). */
export function refresh(jobId?: string) {
  revalidatePath(STUDIO, "layout");
  revalidatePath("/contenido");
  if (jobId) revalidatePath(`${STUDIO}/${jobId}`);
}

/** Token de Google con permiso de Drive, o un mensaje de qué falta. */
export async function driveAccess(): Promise<{ token: string } | { error: string }> {
  try {
    const access = await getGoogleAccess();
    if (access.status !== "ok") return { error: "Conecta tu cuenta de Google (cierra sesión y vuelve a entrar)." };
    if (!access.scopes.includes(DRIVE_FILE_SCOPE))
      return { error: "Falta el permiso de Google Drive: cierra sesión y vuelve a entrar con Google." };
    return { token: access.accessToken };
  } catch (error) {
    return {
      error:
        error instanceof GoogleAuthError
          ? "Google rechazó el acceso: cierra sesión y vuelve a entrar."
          : "Google no respondió. Prueba otra vez en un momento.",
    };
  }
}

/** Comprueba lo necesario para montar vídeos (en tu PC o en GitHub); devuelve el primer problema o null. */
export async function renderBlocker(): Promise<string | null> {
  const supabase = await contentSession();
  const { data } = await supabase.from("studio_settings").select("worker_token_hash, local_token_hash").maybeSingle();
  if (data?.local_token_hash) return null; // tu PC lo monta; GitHub queda de respaldo si está configurado
  if (!studioGithubConfigured())
    return "Falta GITHUB_AGENT_TOKEN en Vercel (lo mismo que para los agentes de Claude Code) o la clave de tu PC.";
  if (!data?.worker_token_hash) return "Falta crear la clave del estudio en Ajustes del estudio.";
  return null;
}

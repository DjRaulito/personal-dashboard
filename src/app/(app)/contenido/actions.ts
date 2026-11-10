"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { askJson, AiUnavailableError } from "@/lib/ai/llm";
import {
  FORMAT_LABEL,
  metricFormSchema,
  PLATFORM_LABEL,
  pieceFormSchema,
  positionBetween,
  quickIdeaSchema,
  STATUSES,
} from "@/lib/content/catalog";
import { contentSession, type Piece } from "@/lib/content/server";
import { zonedDateTime } from "@/lib/datetime";
import { fieldErrors, type FormState } from "@/lib/finance/schemas";
import { CALENDAR_WRITE_SCOPE, deleteCalendarEvent, GoogleAuthError, upsertCalendarEvent } from "@/lib/google/calendar";
import { getGoogleAccess } from "@/lib/google/server";

const id = z.uuid();

function refresh(pieceId?: string) {
  revalidatePath("/contenido", "layout");
  if (pieceId) revalidatePath(`/contenido/pieza/${pieceId}`);
}

/** "2026-11-20T18:30" (hora de Madrid) → ISO UTC */
function localToIso(value: string | null): string | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return zonedDateTime(y, m, d, hh, mm).toISOString();
}

async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

type CalendarSync = "ok" | "skipped" | "no_permission" | "error";

/**
 * Lleva la fecha de publicación a Google Calendar: crea, mueve o borra el evento.
 * Nunca falla el guardado de la pieza; devuelve qué pasó para avisar.
 */
async function syncCalendar(piece: Piece): Promise<CalendarSync> {
  if (!piece.publish_at && !piece.calendar_event_id) return "skipped";
  try {
    const access = await getGoogleAccess();
    if (access.status !== "ok") return "skipped";
    if (!access.scopes.includes(CALENDAR_WRITE_SCOPE)) return "no_permission";
    const supabase = await contentSession();
    if (!piece.publish_at) {
      await deleteCalendarEvent(access.accessToken, piece.calendar_event_id!);
      await supabase.from("content_pieces").update({ calendar_event_id: null }).eq("id", piece.id);
      return "ok";
    }
    const platforms = piece.platforms.map((p) => PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] ?? p).join(", ");
    const eventId = await upsertCalendarEvent(access.accessToken, piece.calendar_event_id, {
      title: `Publicar: ${piece.title}`,
      description: [
        `${FORMAT_LABEL[piece.format as keyof typeof FORMAT_LABEL] ?? piece.format}${platforms ? ` · ${platforms}` : ""}`,
        `${await appOrigin()}/contenido/pieza/${piece.id}`,
      ].join("\n"),
      start: new Date(piece.publish_at),
      minutes: 30,
    });
    if (eventId !== piece.calendar_event_id) {
      await supabase.from("content_pieces").update({ calendar_event_id: eventId }).eq("id", piece.id);
    }
    return "ok";
  } catch (error) {
    console.error("[contenido] calendario", error instanceof Error ? error.message : error);
    return error instanceof GoogleAuthError ? "no_permission" : "error";
  }
}

const CALENDAR_NOTE: Record<CalendarSync, string> = {
  ok: "Guardado y llevado a Google Calendar.",
  skipped: "Guardado.",
  no_permission:
    "Guardado. Para llevar la fecha a Google Calendar, cierra sesión y vuelve a entrar para dar el permiso de escritura.",
  error: "Guardado, pero Google Calendar no respondió. Se reintentará al volver a guardar.",
};

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** Idea rápida desde el banco: va al final de la columna «Idea». */
export async function addIdea(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = quickIdeaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await contentSession();
  const { data: last } = await supabase
    .from("content_pieces")
    .select("position")
    .eq("status", "idea")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("content_pieces")
    .insert({ ...parsed.data, status: "idea", position: positionBetween(last?.position ?? null, null) });
  if (error) return { ok: false, message: "No se pudo guardar la idea." };
  refresh();
  return { ok: true, message: "Idea guardada." };
}

export async function savePiece(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = pieceFormSchema.safeParse({
    ...Object.fromEntries(formData),
    platforms: formData.getAll("platforms"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { id: pieceId, publish_at, ...values } = parsed.data;
  const row = { ...values, publish_at: localToIso(publish_at) };
  const supabase = await contentSession();

  const { data: piece, error } = pieceId
    ? await supabase.from("content_pieces").update(row).eq("id", pieceId).select("*").single()
    : await supabase.from("content_pieces").insert(row).select("*").single();
  if (error || !piece) return { ok: false, message: "No se pudo guardar la pieza." };

  const sync = await syncCalendar(piece);
  refresh(piece.id);
  if (!pieceId) redirect(`/contenido/pieza/${piece.id}`);
  return { ok: sync !== "error", message: CALENDAR_NOTE[sync] };
}

/**
 * Mueve una ficha del tablero a otra columna y la coloca entre dos vecinas.
 * Al pasar a «Publicado» sin fecha, se apunta ahora como fecha de publicación.
 */
export async function movePiece(input: {
  id: string;
  status: string;
  beforeId: string | null;
  afterId: string | null;
}): Promise<{ ok: boolean }> {
  const parsed = z
    .object({ id, status: z.enum(STATUSES), beforeId: id.nullable(), afterId: id.nullable() })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const { status, beforeId, afterId } = parsed.data;
  const supabase = await contentSession();
  const neighbours = [beforeId, afterId].filter((v): v is string => Boolean(v));
  const { data: rows } = neighbours.length
    ? await supabase.from("content_pieces").select("id, position").in("id", neighbours)
    : { data: [] as { id: string; position: number }[] };
  const pos = (nid: string | null) => rows?.find((r) => r.id === nid)?.position ?? null;

  const { data: current } = await supabase
    .from("content_pieces")
    .select("publish_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!current) return { ok: false };
  const { error } = await supabase
    .from("content_pieces")
    .update({
      status,
      position: positionBetween(pos(beforeId), pos(afterId)),
      ...(status === "published" && !current.publish_at ? { publish_at: new Date().toISOString() } : {}),
    })
    .eq("id", parsed.data.id);
  refresh();
  return { ok: !error };
}

export async function deletePiece(pieceId: string) {
  const supabase = await contentSession();
  const { data: piece } = await supabase
    .from("content_pieces")
    .select("calendar_event_id")
    .eq("id", id.parse(pieceId))
    .maybeSingle();
  if (piece?.calendar_event_id) {
    try {
      const access = await getGoogleAccess();
      if (access.status === "ok") await deleteCalendarEvent(access.accessToken, piece.calendar_event_id);
    } catch {
      // El evento se queda en Google; no impide borrar la pieza
    }
  }
  await supabase.from("content_pieces").delete().eq("id", pieceId);
  refresh();
  redirect("/contenido");
}

// ---------------------------------------------------------------------------
// Guion con IA
// ---------------------------------------------------------------------------

const scriptSchema = z.object({ script: z.string().min(20).max(20000) });

export async function writeScriptWithAi(pieceId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await contentSession();
  const { data: piece } = await supabase.from("content_pieces").select("*").eq("id", id.parse(pieceId)).maybeSingle();
  if (!piece) return { ok: false, message: "No existe la pieza." };
  const long = piece.format === "long";
  try {
    const { script } = await askJson(
      scriptSchema,
      [
        "Eres guionista de contenido para redes en español de España, tono cercano y directo.",
        'Devuelve JSON {"script": string}. El guion va en texto plano, con secciones marcadas',
        "[GANCHO], [DESARROLLO] y [CIERRE] y, entre paréntesis, indicaciones breves de plano.",
        long
          ? "Vídeo largo de 6 a 10 minutos (unas 1000-1400 palabras)."
          : "Vídeo corto vertical de 30 a 60 segundos (unas 90-150 palabras). El gancho, en los 3 primeros segundos.",
      ].join(" "),
      [
        `Título o idea: ${piece.title}`,
        piece.notes ? `Notas: ${piece.notes}` : "",
        piece.tags.length ? `Etiquetas: ${piece.tags.join(", ")}` : "",
        piece.platforms.length ? `Plataformas: ${piece.platforms.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    const { error } = await supabase
      .from("content_pieces")
      .update({ script, ...(piece.status === "idea" ? { status: "script" } : {}) })
      .eq("id", piece.id);
    if (error) return { ok: false, message: "No se pudo guardar el guion." };
    refresh(piece.id);
    return { ok: true, message: "Guion escrito. Revísalo y ajústalo a tu estilo." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AiUnavailableError || error instanceof Error ? error.message : "La IA no respondió.",
    };
  }
}

// ---------------------------------------------------------------------------
// Métricas e ingresos
// ---------------------------------------------------------------------------

export async function saveMetric(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = metricFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await contentSession();
  const { error } = await supabase
    .from("content_metrics")
    .upsert(parsed.data, { onConflict: "piece_id,platform,recorded_on" });
  if (error) return { ok: false, message: "No se pudieron guardar las métricas." };
  refresh(parsed.data.piece_id);
  return { ok: true, message: "Métricas guardadas." };
}

export async function deleteMetric(metricId: string, pieceId: string) {
  const supabase = await contentSession();
  await supabase.from("content_metrics").delete().eq("id", id.parse(metricId));
  refresh(id.parse(pieceId));
}

export async function linkTransaction(pieceId: string, transactionId: string): Promise<{ ok: boolean }> {
  const supabase = await contentSession();
  const { error } = await supabase
    .from("content_piece_transactions")
    .upsert(
      { piece_id: id.parse(pieceId), transaction_id: id.parse(transactionId) },
      { onConflict: "piece_id,transaction_id", ignoreDuplicates: true },
    );
  refresh(pieceId);
  return { ok: !error };
}

export async function unlinkTransaction(pieceId: string, transactionId: string) {
  const supabase = await contentSession();
  await supabase
    .from("content_piece_transactions")
    .delete()
    .eq("piece_id", id.parse(pieceId))
    .eq("transaction_id", id.parse(transactionId));
  refresh(pieceId);
}

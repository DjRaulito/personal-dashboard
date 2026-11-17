import "server-only";
import { randomUUID } from "node:crypto";

// «Probar en mí»: imagen realista de una prenda puesta sobre una foto de cuerpo entero.
// Usa un Space público de Hugging Face (Leffa, sobre ZeroGPU) con el token gratuito del usuario:
// tiene un cupo diario de GPU, así que puede decir que no cuando se agota.
// Se usa la cola de Gradio (queue/join + queue/data) porque es la única vía que devuelve el
// motivo de un fallo (p. ej. cupo agotado); la API /call solo dice «error».

const SPACE = process.env.TRYON_SPACE_URL || "https://franciszzj-leffa.hf.space";
// Índice de la función «leffa_predict_vt» en el Space (ver /gradio_api/info)
const FN_INDEX = 2;
// Cola + arranque en frío + generación: puede pasar del minuto
const CALL_TIMEOUT_MS = 240_000;

export type TryOnPart = "upper_body" | "lower_body";

export class TryOnError extends Error {
  constructor(
    message: string,
    /** Se ha agotado el cupo gratuito de hoy. */
    readonly quota = false,
  ) {
    super(message);
  }
}

export const tryOnConfigured = () => Boolean(process.env.HF_TOKEN);

const headers = (): Record<string, string> =>
  process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};

export interface Photo {
  bytes: Uint8Array;
  mime: string;
}

async function upload(photo: Photo, name: string): Promise<string> {
  const form = new FormData();
  form.append("files", new Blob([photo.bytes as BlobPart], { type: photo.mime }), name);
  const res = await fetch(`${SPACE}/gradio_api/upload`, {
    method: "POST",
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!res.ok) throw new TryOnError(`El servicio de prueba no aceptó la foto (${res.status}).`);
  const paths = (await res.json()) as unknown;
  if (!Array.isArray(paths) || typeof paths[0] !== "string")
    throw new TryOnError("El servicio de prueba no aceptó la foto.");
  return paths[0];
}

export interface QueueMessage {
  msg: string;
  success?: boolean;
  title?: string;
  output?: { data?: unknown[]; error?: string | null };
}

/** Mensajes de la cola de Gradio (líneas «data: {...}» de un text/event-stream). */
export function queueMessages(stream: string): QueueMessage[] {
  const out: QueueMessage[] = [];
  for (const line of stream.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    try {
      const parsed = JSON.parse(line.slice(5).trim()) as unknown;
      if (parsed && typeof parsed === "object" && typeof (parsed as QueueMessage).msg === "string") {
        out.push(parsed as QueueMessage);
      }
    } catch {
      // línea incompleta o que no es JSON: se ignora
    }
  }
  return out;
}

/** Convierte el error del servicio en un mensaje para la interfaz. */
export function tryOnFailure(message: QueueMessage | null | undefined): TryOnError {
  const text = [message?.title, message?.output?.error].filter(Boolean).join(" ");
  if (/quota|exceeded|runs limit/i.test(text)) {
    return new TryOnError(
      "Se ha agotado el cupo gratuito de hoy del servicio de prueba. Vuelve a intentarlo mañana.",
      true,
    );
  }
  if (/queue|busy|too many|full/i.test(text) || message?.msg === "queue_full") {
    return new TryOnError("El servicio de prueba está saturado ahora. Inténtalo en unos minutos.");
  }
  return new TryOnError(
    "El servicio de prueba no pudo generar la imagen. Prueba con una foto de cuerpo entero, de frente y con buena luz.",
  );
}

/** Ruta o URL de la imagen generada dentro de la respuesta final. */
export function resultUrl(message: QueueMessage, space = SPACE): string | null {
  const first = message.output?.data?.[0] as { url?: unknown; path?: unknown } | null | undefined;
  const url =
    typeof first?.url === "string"
      ? first.url
      : typeof first?.path === "string"
        ? `${space}/gradio_api/file=${first.path}`
        : null;
  // Solo se descarga del propio Space
  return url && url.startsWith(`${space}/`) ? url : null;
}

/** Pone una prenda sobre la foto de una persona y devuelve la imagen generada. */
export async function tryOnGarment(person: Photo, garment: Photo, part: TryOnPart): Promise<Photo> {
  const [personPath, garmentPath] = await Promise.all([upload(person, "persona.jpg"), upload(garment, "prenda.jpg")]);
  const file = (path: string) => ({ path, meta: { _type: "gradio.FileData" } });
  const session = randomUUID().replace(/-/g, "").slice(0, 11);

  const join = await fetch(`${SPACE}/gradio_api/queue/join`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      // persona, prenda, aceleración, pasos, escala, semilla, modelo, zona, repintado
      data: [
        file(personPath),
        file(garmentPath),
        false,
        30,
        2.5,
        42,
        part === "lower_body" ? "dress_code" : "viton_hd",
        part,
        false,
      ],
      fn_index: FN_INDEX,
      trigger_id: null,
      session_hash: session,
      event_data: null,
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!join.ok) {
    throw join.status === 429
      ? tryOnFailure({ msg: "queue_full" })
      : new TryOnError(`El servicio de prueba no está disponible ahora (${join.status}).`);
  }

  let stream: string;
  try {
    const res = await fetch(`${SPACE}/gradio_api/queue/data?session_hash=${session}`, {
      headers: { ...headers(), Accept: "text/event-stream" },
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      cache: "no-store",
    });
    stream = await res.text();
  } catch {
    throw new TryOnError("El servicio de prueba ha tardado demasiado. Inténtalo de nuevo.");
  }
  const messages = queueMessages(stream);
  const done = messages.find((m) => m.msg === "process_completed") ?? messages.find((m) => m.msg === "queue_full");
  if (!done || done.success === false || done.msg !== "process_completed") throw tryOnFailure(done);
  const url = resultUrl(done);
  if (!url) throw tryOnFailure(done);
  const image = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!image.ok) throw new TryOnError("No se pudo descargar la imagen generada.");
  return { bytes: new Uint8Array(await image.arrayBuffer()), mime: image.headers.get("content-type") ?? "image/webp" };
}

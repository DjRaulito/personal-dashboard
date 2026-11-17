import "server-only";

// «Probar en mí»: imagen realista de una prenda puesta sobre una foto de cuerpo entero.
// Usa un Space público de Hugging Face (Leffa, sobre ZeroGPU) con el token gratuito del usuario:
// tiene un cupo diario de GPU, así que puede decir que no cuando se agota.

const SPACE = process.env.TRYON_SPACE_URL || "https://franciszzj-leffa.hf.space";
const ENDPOINT = "leffa_predict_vt";
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

interface Photo {
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
  if (!Array.isArray(paths) || typeof paths[0] !== "string") throw new TryOnError("El servicio de prueba no aceptó la foto.");
  return paths[0];
}

/** Último evento de la respuesta (text/event-stream) de una llamada a Gradio. */
export function lastEvent(stream: string): { event: string; data: unknown } | null {
  let found: { event: string; data: unknown } | null = null;
  for (const block of stream.split(/\r?\n\r?\n/)) {
    const event = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim();
    const data = /^data:\s*(.*)$/m.exec(block)?.[1];
    if (!event || event === "heartbeat" || event === "generating") continue;
    let parsed: unknown = null;
    try {
      parsed = data ? JSON.parse(data) : null;
    } catch {
      parsed = data ?? null;
    }
    found = { event, data: parsed };
  }
  return found;
}

/** Convierte el error del servicio en un mensaje para la interfaz. */
export function tryOnFailure(data: unknown): TryOnError {
  const text = typeof data === "string" ? data : data ? JSON.stringify(data) : "";
  if (/quota|exceeded/i.test(text)) {
    return new TryOnError("Se ha agotado el cupo gratuito de hoy del servicio de prueba. Vuelve a intentarlo mañana.", true);
  }
  if (/queue|busy|too many/i.test(text)) return new TryOnError("El servicio de prueba está saturado ahora. Inténtalo en unos minutos.");
  return new TryOnError("El servicio de prueba no pudo generar la imagen. Prueba con una foto de cuerpo entero, de frente y con buena luz.");
}

/** Pone una prenda sobre la foto de una persona y devuelve la imagen generada. */
export async function tryOnGarment(person: Photo, garment: Photo, part: TryOnPart): Promise<Photo> {
  const [personPath, garmentPath] = await Promise.all([upload(person, "persona.jpg"), upload(garment, "prenda.jpg")]);
  const file = (path: string) => ({ path, meta: { _type: "gradio.FileData" } });
  const start = await fetch(`${SPACE}/gradio_api/call/${ENDPOINT}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    // persona, prenda, aceleración, pasos, escala, semilla, modelo, zona, repintado
    body: JSON.stringify({
      data: [file(personPath), file(garmentPath), false, 30, 2.5, 42, part === "lower_body" ? "dress_code" : "viton_hd", part, false],
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const started = (await start.json().catch(() => null)) as { event_id?: string } | null;
  if (!start.ok || !started?.event_id) throw new TryOnError(`El servicio de prueba no está disponible ahora (${start.status}).`);

  let stream: string;
  try {
    const res = await fetch(`${SPACE}/gradio_api/call/${ENDPOINT}/${started.event_id}`, {
      headers: headers(),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      cache: "no-store",
    });
    stream = await res.text();
  } catch {
    throw new TryOnError("El servicio de prueba ha tardado demasiado. Inténtalo de nuevo.");
  }
  const last = lastEvent(stream);
  if (last?.event !== "complete") throw tryOnFailure(last?.data);
  const output = (Array.isArray(last.data) ? last.data[0] : null) as { url?: string; path?: string } | null;
  const url = output?.url ?? (output?.path ? `${SPACE}/gradio_api/file=${output.path}` : null);
  if (!url || !url.startsWith(SPACE)) throw tryOnFailure(last.data);
  const image = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!image.ok) throw new TryOnError("No se pudo descargar la imagen generada.");
  return { bytes: new Uint8Array(await image.arrayBuffer()), mime: image.headers.get("content-type") ?? "image/webp" };
}

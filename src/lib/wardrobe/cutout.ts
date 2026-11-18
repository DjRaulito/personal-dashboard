// Prepara la foto de una prenda en el navegador: la reduce, le quita el fondo con un modelo
// que corre en el propio dispositivo (la foto no sale de aquí) y la recorta a la prenda.
// Si el modelo no se puede cargar, se guarda la foto tal cual, sin recortar.
import type { ImageInput } from "@/lib/ai/image";
import { alphaBounds, alphaCoverage, keepMainPieces } from "./alpha";

const MODEL = "briaai/RMBG-1.4";
const MAX_SIDE = 1024;
const OUT_SIDE = 800;
const MAX_BYTES = 2 * 1024 * 1024;

export type CutoutStage = { step: "model"; progress: number } | { step: "cutting" } | { step: "saving" };

export interface PreparedPhoto {
  blob: Blob;
  extension: "webp" | "png" | "jpg";
  /** true si se ha quitado el fondo. */
  cutout: boolean;
  /** Versión pequeña en JPEG para que la IA la etiquete. */
  forAi: ImageInput;
  /** Foto y máscara para retocar el recorte a mano. */
  source: CutoutSource;
}

export interface CutoutSource {
  /** Foto sin recortar (no se modifica). */
  original: HTMLCanvasElement;
  /** Un valor 0–255 por píxel: lo que se ve de la foto. */
  mask: Uint8ClampedArray;
  /** false si la foto ya venía recortada: lo borrado no se puede recuperar. */
  restorable: boolean;
}

function draw(source: CanvasImageSource, sw: number, sh: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la foto");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), type, quality),
  );

function jpegForAi(canvas: HTMLCanvasElement): ImageInput {
  // Fondo blanco: el JPEG no tiene transparencia
  const small = document.createElement("canvas");
  const scale = Math.min(1, 768 / Math.max(canvas.width, canvas.height));
  small.width = Math.round(canvas.width * scale);
  small.height = Math.round(canvas.height * scale);
  const ctx = small.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, small.width, small.height);
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const url = small.toDataURL("image/jpeg", 0.8);
  return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

// El modelo (~45 MB) se descarga una vez y el navegador lo guarda en caché
type Segmenter = (canvas: HTMLCanvasElement) => Promise<Uint8ClampedArray>;
let segmenter: Promise<Segmenter> | null = null;

async function loadSegmenter(onProgress: (p: number) => void): Promise<Segmenter> {
  const { AutoModel, AutoProcessor, RawImage } = await import("@huggingface/transformers");
  const progress_callback = (e: { status?: string; file?: string; progress?: number }) => {
    if (e.status === "progress" && e.file?.endsWith(".onnx") && typeof e.progress === "number") onProgress(e.progress);
  };
  const model = await AutoModel.from_pretrained(MODEL, {
    // El modelo no declara un tipo que la librería conozca
    config: { model_type: "custom" } as never,
    dtype: "q8",
    progress_callback,
  });
  const processor = await AutoProcessor.from_pretrained(MODEL, {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      feature_extractor_type: "ImageFeatureExtractor",
      image_std: [1, 1, 1],
      resample: 2,
      rescale_factor: 0.00392156862745098,
      size: { width: 1024, height: 1024 },
    },
  } as never);
  return async (canvas) => {
    const image = RawImage.fromCanvas(canvas);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(canvas.width, canvas.height);
    return mask.data as Uint8ClampedArray;
  };
}

/** Máscara de la prenda (sin fondo ni trozos sueltos); null si el resultado no sirve. */
async function cutOut(canvas: HTMLCanvasElement, onStage: (s: CutoutStage) => void): Promise<Uint8ClampedArray | null> {
  onStage({ step: "model", progress: 0 });
  segmenter ??= loadSegmenter((progress) => onStage({ step: "model", progress }));
  let run: Segmenter;
  try {
    run = await segmenter;
  } catch (e) {
    segmenter = null; // para poder reintentar con la siguiente foto
    throw e;
  }
  onStage({ step: "cutting" });
  const mask = keepMainPieces(await run(canvas), canvas.width, canvas.height);
  // Si no ha separado nada (todo visible o todo borrado), mejor la foto original
  const rgba = withMask(canvas, mask).getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  if (alphaCoverage(rgba) > 0.97 || !alphaBounds(rgba, canvas.width, canvas.height)) return null;
  return mask;
}

/** Copia de la foto con la máscara como transparencia. */
function withMask(original: HTMLCanvasElement, mask: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = original.width;
  canvas.height = original.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(original, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < mask.length; i++) pixels.data[i * 4 + 3] = Math.min(pixels.data[i * 4 + 3], mask[i]);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** Aplica la máscara, recorta a la prenda y la deja lista para subir. */
export async function composeCutout(
  source: CutoutSource,
  mask: Uint8ClampedArray,
): Promise<Pick<PreparedPhoto, "blob" | "extension" | "cutout">> {
  const canvas = withMask(source.original, mask);
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  const bounds = alphaBounds(data, canvas.width, canvas.height);
  if (!bounds) throw new Error("Has borrado toda la prenda.");
  const trimmed = document.createElement("canvas");
  trimmed.width = bounds.width;
  trimmed.height = bounds.height;
  trimmed.getContext("2d")!.drawImage(canvas, -bounds.x, -bounds.y);
  return { ...(await encode(trimmed, true)), cutout: true };
}

/** Fuente para retocar una prenda ya guardada (su foto recortada). */
export async function sourceFromImage(blob: Blob, cutout: boolean): Promise<CutoutSource> {
  const bitmap = await createImageBitmap(blob);
  const original = draw(bitmap, bitmap.width, bitmap.height, MAX_SIDE);
  bitmap.close();
  const data = original.getContext("2d")!.getImageData(0, 0, original.width, original.height).data;
  const mask = new Uint8ClampedArray(original.width * original.height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3];
  return { original, mask, restorable: !cutout };
}

async function encode(
  canvas: HTMLCanvasElement,
  transparent: boolean,
): Promise<Pick<PreparedPhoto, "blob" | "extension">> {
  for (const side of [OUT_SIDE, 640, 480]) {
    const sized = draw(canvas, canvas.width, canvas.height, side);
    // Safari no sabe escribir WebP y devuelve PNG: se mira el tipo real
    const blob = await toBlob(sized, transparent ? "image/webp" : "image/jpeg", 0.85);
    if (blob.size > MAX_BYTES) continue;
    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return { blob, extension };
  }
  throw new Error("La foto es demasiado grande");
}

export async function prepareGarmentPhoto(
  file: File,
  onStage: (s: CutoutStage) => void = () => {},
): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file);
  const original = draw(bitmap, bitmap.width, bitmap.height, MAX_SIDE);
  bitmap.close();
  const forAi = jpegForAi(original);
  let mask: Uint8ClampedArray | null = null;
  try {
    mask = await cutOut(original, onStage);
  } catch (e) {
    console.warn("[armario] no se pudo quitar el fondo", e);
  }
  onStage({ step: "saving" });
  // Sin recorte la máscara deja ver toda la foto, y se puede borrar el fondo a mano
  const source: CutoutSource = {
    original,
    mask: mask ?? new Uint8ClampedArray(original.width * original.height).fill(255),
    restorable: true,
  };
  if (mask) return { ...(await composeCutout(source, mask)), forAi, source };
  return { ...(await encode(original, false)), cutout: false, forAi, source };
}

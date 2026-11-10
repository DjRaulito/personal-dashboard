// Reduce una foto en el navegador antes de mandarla a la IA (JPEG, lado mayor ~1280 px).
import type { ImageInput } from "@/lib/ai/image";

export async function resizeImage(file: File, maxSide = 1280, quality = 0.8): Promise<ImageInput> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la foto");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", quality);
  return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

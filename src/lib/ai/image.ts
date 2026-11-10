// Validación de las fotos que se mandan a la IA (compartido entre cliente y servidor).
import { z } from "zod";

/** ~1 MB en base64: la foto se reduce antes en el navegador (ver resizeImage). */
export const MAX_IMAGE_CHARS = 1_400_000;

export const imageSchema = z.object({
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z
    .string()
    .min(100)
    .max(MAX_IMAGE_CHARS, "La foto es demasiado grande")
    .regex(/^[A-Za-z0-9+/]+=*$/, "Foto no válida"),
});
export type ImageInput = z.infer<typeof imageSchema>;

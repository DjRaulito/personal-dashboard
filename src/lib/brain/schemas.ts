import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** «gym, Rutina,  gym» → ["gym", "rutina"] (hasta 8, de 30 caracteres como mucho). */
export function parseTags(raw: string): string[] {
  const tags = raw
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase().slice(0, 30))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 8);
}

export const memoryFormSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  title: z.string().trim().min(1, "Ponle un título").max(80, "Máximo 80 caracteres"),
  content: z.string().trim().min(1, "Escribe el recuerdo").max(2000, "Máximo 2.000 caracteres"),
  tags: z.string().default("").transform(parseTags),
});

/** Token nuevo: se muestra una vez; en la base solo se guarda su hash. */
export function newToken(): { token: string; hash: string } {
  const token = `brain_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export const MAX_GRAPH_NODES = 250;

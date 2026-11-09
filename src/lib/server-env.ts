import { z } from "zod";

// Variables solo de servidor. Son opcionales: sin ellas la app funciona, pero
// la integración con Google Calendar aparece como "sin configurar".
const serverSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  /** 32 bytes en base64 (`openssl rand -base64 32`) para cifrar tokens. */
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "Debe ser una clave de 32 bytes en base64")
    .optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // Las cadenas vacías cuentan como "no definida"
  const clean = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
  return serverSchema.parse(clean);
}

/** Devuelve la configuración de Google o null si falta alguna variable. */
export function googleConfigFrom(e: ServerEnv): GoogleConfig | null {
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET || !e.TOKEN_ENCRYPTION_KEY) return null;
  return { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, encryptionKey: e.TOKEN_ENCRYPTION_KEY };
}

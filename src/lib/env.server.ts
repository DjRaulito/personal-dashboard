import "server-only";
import { googleConfigFrom, parseServerEnv, type GoogleConfig } from "@/lib/server-env";

/** Configuración de Google leída de las variables de entorno del servidor. */
export function getGoogleConfig(): GoogleConfig | null {
  return googleConfigFrom(
    parseServerEnv({
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    }),
  );
}

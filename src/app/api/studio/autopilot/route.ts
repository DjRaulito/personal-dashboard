import { after, NextResponse, type NextRequest } from "next/server";
import { decryptToken } from "@/lib/crypto";
import { getGoogleConfig } from "@/lib/env.server";
import { refreshAccessToken } from "@/lib/google/calendar";
import { runJob, tokenStore } from "@/lib/studio/pipeline";

// Piloto automático del VoiceStudio. Lo llama cada día el workflow `studio-autopilot.yml` con la
// clave del estudio; no hay sesión, así que todo pasa por la función `studio_worker`.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token.startsWith("studio_")) return NextResponse.json({ error: "Falta la clave" }, { status: 401 });

  const store = tokenStore(token);
  let pick;
  try {
    pick = await store.autopilot();
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return NextResponse.json({ error: message }, { status: message === "Clave no válida" ? 401 : 500 });
  }
  if ("skip" in pick) return NextResponse.json({ skipped: pick.skip });

  // Token de Google para abrir las subidas a Drive (el refresh token llega cifrado)
  let googleAccess: string | null = null;
  const config = getGoogleConfig();
  if (config && pick.google_token) {
    try {
      googleAccess = await refreshAccessToken(
        decryptToken(pick.google_token, config.encryptionKey),
        config.clientId,
        config.clientSecret,
      );
    } catch {
      googleAccess = null;
    }
  }

  after(() =>
    runJob(
      store,
      { id: pick.job_id, topic: pick.topic, format: pick.format, target_seconds: pick.target_seconds },
      googleAccess,
      false,
    ),
  );
  return NextResponse.json({ started: pick.job_id }, { status: 202 });
}

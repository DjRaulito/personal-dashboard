import type { Metadata } from "next";
import { StudioSettingsForm, VoiceSample, WorkerKey } from "@/components/studio/settings";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { aiConfigured, aiProviderNames } from "@/lib/ai/llm";
import { DRIVE_FILE_SCOPE } from "@/lib/google/calendar";
import { hasGoogleScope } from "@/lib/google/server";
import { AI_VOICES, type AiVoice } from "@/lib/studio/catalog";
import { studioGithubConfigured } from "@/lib/studio/github";
import { stockConfigured, stockSources } from "@/lib/studio/stock";
import { getStudioSettings } from "@/lib/studio/server";

export const metadata: Metadata = { title: "Ajustes · VoiceStudio" };
export const dynamic = "force-dynamic";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5 text-sm">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-finance" : "bg-attention"}`}
      />
      <span>
        <span className="sr-only">{ok ? "Listo: " : "Falta: "}</span>
        {children}
      </span>
    </li>
  );
}

export default async function StudioSettingsPage() {
  const [settings, drive] = await Promise.all([getStudioSettings(), hasGoogleScope(DRIVE_FILE_SCOPE)]);
  const voice = (settings?.ai_voice ?? "es_male") as AiVoice;
  const hasSample = Boolean(settings?.has_voice_sample);

  return (
    <>
      <BackLink href="/contenido/estudio">VoiceStudio</BackLink>
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <Tile>
            <TileTitle dot="bg-content">Puesta a punto</TileTitle>
            <ul className="mt-3">
              <Check ok={aiConfigured()}>
                IA para los guiones
                {aiConfigured()
                  ? `: ${aiProviderNames().join(" → ")}`
                  : " (GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY u OPENROUTER_API_KEY)"}
              </Check>
              <Check ok={drive}>Permiso de Google Drive (cierra sesión y vuelve a entrar con Google si falta)</Check>
              <Check ok={studioGithubConfigured()}>
                GitHub para el montaje (GITHUB_AGENT_TOKEN en Vercel, con Actions y Secrets)
              </Check>
              <Check ok={Boolean(settings?.worker_token_hash)}>Clave del estudio (abajo)</Check>
              <Check ok={stockConfigured()}>
                Clips de stock
                {stockConfigured()
                  ? `: ${stockSources().join(" y ")}`
                  : ": PIXABAY_API_KEY en Vercel (gratis en pixabay.com/api/docs). Opcional: sin ella, fondos animados"}
              </Check>
            </ul>
          </Tile>
          <Tile>
            <TileTitle dot="bg-content">Clave del estudio</TileTitle>
            <div className="mt-3">
              <WorkerKey configured={Boolean(settings?.worker_token_hash)} />
            </div>
          </Tile>
          <Tile>
            <TileTitle dot="bg-content">Voz y piloto automático</TileTitle>
            <div className="mt-4">
              <StudioSettingsForm
                hasSample={hasSample}
                values={{
                  ai_voice: voice in AI_VOICES ? voice : "es_male",
                  autopilot: settings?.autopilot ?? false,
                  autopilot_days: settings?.autopilot_days ?? [1, 4],
                  autopilot_format: settings?.autopilot_format === "long" ? "long" : "short",
                  autopilot_voice: settings?.autopilot_voice === "clone" ? "clone" : "ai",
                }}
              />
            </div>
          </Tile>
        </div>
        <Tile>
          <TileTitle dot="bg-content">Tu voz</TileTitle>
          <div className="mt-3">
            <VoiceSample hasSample={hasSample} />
          </div>
        </Tile>
      </div>
    </>
  );
}

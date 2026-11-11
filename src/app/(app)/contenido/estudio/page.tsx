import type { Metadata } from "next";
import Link from "next/link";
import { StudioComposer } from "@/components/studio/composer";
import { JobCard } from "@/components/studio/job-card";
import { LiveStudio } from "@/components/studio/live-studio";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/llm";
import { contentSession } from "@/lib/content/server";
import { AI_VOICES, type AiVoice } from "@/lib/studio/catalog";
import { studioGithubConfigured } from "@/lib/studio/github";
import { stockConfigured } from "@/lib/studio/clips/stock";
import { getJobs, getStudioSettings, syncActiveJobs } from "@/lib/studio/server";

export const metadata: Metadata = { title: "Estudio de vídeo · Contenido" };
// Escribir el guion y preparar la subida corre después de responder (after)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ pieza?: string }> }) {
  const { pieza } = await searchParams;
  await syncActiveJobs().catch(() => undefined);
  const supabase = await contentSession();
  const [jobs, settings, { data: ideas }] = await Promise.all([
    getJobs(),
    getStudioSettings(),
    supabase
      .from("content_pieces")
      .select("id, title, notes, format")
      .in("status", ["idea", "script"])
      .in("format", ["short", "long"])
      .order("priority")
      .order("created_at")
      .limit(100),
  ]);
  const active = jobs.some((j) => ["scripting", "queued", "rendering"].includes(j.status));

  const missing = [
    !aiConfigured() && "una clave de IA (guiones)",
    !settings?.local_token_hash && !studioGithubConfigured() && "GITHUB_AGENT_TOKEN (montaje en GitHub Actions)",
    !settings?.local_token_hash && !settings?.worker_token_hash && "la clave de tu PC o de GitHub",
  ].filter(Boolean);
  const voice = (settings?.ai_voice ?? "es_male") as AiVoice;

  return (
    <>
      <LiveStudio active={active} />
      {missing.length > 0 && (
        <p className="bg-surface-2 rounded-inner text-attention px-4 py-3 text-sm">
          Para montar vídeos falta: {missing.join(", ")}.{" "}
          <Link href="/contenido/estudio/ajustes" className="underline underline-offset-2">
            Ir a Ajustes del estudio
          </Link>
        </p>
      )}
      <div className="grid items-start gap-3.5 lg:grid-cols-5">
        <Tile className="lg:col-span-2">
          <TileTitle dot="bg-content">Nuevo vídeo</TileTitle>
          <p className="text-muted mt-1 text-sm">
            Guion con IA, voz, clips de stock
            {stockConfigured() ? "" : " (falta PIXABAY_API_KEY: de momento, fondos animados)"}, subtítulos y montaje.
            Queda en tu Google Drive para que lo apruebes.
          </p>
          <div className="mt-5">
            <StudioComposer
              ideas={(ideas ?? []).map((i) => ({ id: i.id, title: i.title, notes: i.notes, format: i.format }))}
              defaultVoice={voice in AI_VOICES ? voice : "es_male"}
              hasSample={Boolean(settings?.has_voice_sample)}
              initialPieceId={pieza}
            />
          </div>
        </Tile>

        <Tile className="lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TileTitle dot="bg-content">Vídeos</TileTitle>
            <Link
              href="/contenido/estudio/ajustes"
              className="text-muted hover:text-text rounded-full px-3 py-1.5 text-sm transition-colors duration-150"
            >
              Ajustes y piloto automático →
            </Link>
          </div>
          {settings?.autopilot && (
            <p className="text-muted mt-1 text-sm">
              Piloto automático encendido: convierte la siguiente idea del banco en vídeo los días elegidos.
            </p>
          )}
          {jobs.length ? (
            <ul className="divide-border mt-3 divide-y">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Aún no has creado ningún vídeo.</EmptyState>
          )}
        </Tile>
      </div>
    </>
  );
}

import "server-only";
import sodium from "libsodium-wrappers";
import { gh, githubRepo } from "@/lib/agents/github";

// El montaje corre en GitHub Actions (workflow `studio.yml`). Usa el mismo token que los agentes
// de Claude Code (GITHUB_AGENT_TOKEN); para guardar la clave del estudio como secreto del repo,
// el token necesita además el permiso «Secrets: lectura y escritura».

const WORKFLOW = "studio.yml";

export const studioGithubConfigured = () => Boolean(process.env.GITHUB_AGENT_TOKEN && githubRepo());
export const studioRunTitle = (jobId: string) => `studio-${jobId}`;

export async function dispatchStudio(jobId: string): Promise<void> {
  const res = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: process.env.GITHUB_AGENT_REF || "main",
      inputs: {
        job_id: jobId,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub no aceptó el montaje (${res.status}).`);
}

export interface StudioRun {
  id: number;
  url: string;
  status: string;
  conclusion: string | null;
}

/** Ejecuciones recientes del montaje, por id de trabajo. */
export async function recentStudioRuns(since: string): Promise<Map<string, StudioRun>> {
  const created = since.slice(0, 19) + "Z";
  const res = await gh(
    `/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=50&created=${encodeURIComponent(`>=${created}`)}`,
  );
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = (await res.json()) as {
    workflow_runs?: {
      id: number;
      html_url: string;
      status: string;
      conclusion: string | null;
      display_title: string;
    }[];
  };
  const out = new Map<string, StudioRun>();
  for (const r of data.workflow_runs ?? []) {
    const m = r.display_title.match(/^studio-([0-9a-f-]{36})$/);
    if (m && !out.has(m[1])) out.set(m[1], { id: r.id, url: r.html_url, status: r.status, conclusion: r.conclusion });
  }
  return out;
}

export async function cancelStudioRun(id: number): Promise<void> {
  await gh(`/actions/runs/${id}/cancel`, { method: "POST" });
}

/** Guarda (o sustituye) un secreto de Actions del repo, cifrado con la clave pública del repo. */
export async function setRepoSecret(name: string, value: string): Promise<void> {
  const keyRes = await gh(`/actions/secrets/public-key`);
  if (!keyRes.ok) throw new Error(`GitHub ${keyRes.status}`);
  const { key, key_id } = (await keyRes.json()) as { key: string; key_id: string };
  await sodium.ready;
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(key, sodium.base64_variants.ORIGINAL),
  );
  const res = await gh(`/actions/secrets/${name}`, {
    method: "PUT",
    body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id }),
  });
  if (!res.ok) throw new Error(`GitHub no guardó el secreto (${res.status}).`);
}

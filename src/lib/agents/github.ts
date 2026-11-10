import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import { workflowTitle } from "./catalog";

// Motor Claude Code: la app lanza el workflow `agent.yml` con la API de GitHub y luego
// consulta su estado y descarga el resultado (artefacto). Necesita GITHUB_AGENT_TOKEN
// (token fine-grained con Actions y Pull requests de lectura/escritura sobre el repo).

const WORKFLOW = "agent.yml";
const API = "https://api.github.com";

export function githubRepo(): string | null {
  if (process.env.GITHUB_AGENT_REPO) return process.env.GITHUB_AGENT_REPO;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  return owner && slug ? `${owner}/${slug}` : null;
}

export const claudeConfigured = () => Boolean(process.env.GITHUB_AGENT_TOKEN && githubRepo());

/** Llamada a la API de GitHub sobre el repo del dashboard (la usan también el VoiceStudio). */
export async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  const repo = githubRepo();
  if (!process.env.GITHUB_AGENT_TOKEN || !repo) {
    throw new Error("Falta configurar GITHUB_AGENT_TOKEN en Vercel para los agentes de Claude Code.");
  }
  return fetch(`${API}/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_AGENT_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
}

export interface DispatchInput {
  runId: string;
  prompt: string;
  maxTurns: number;
  allowCode: boolean;
  allowWeb: boolean;
  branch: string;
}

export async function dispatchWorkflow(input: DispatchInput): Promise<void> {
  const res = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: process.env.GITHUB_AGENT_REF || "main",
      inputs: {
        run_id: input.runId,
        prompt: input.prompt,
        max_turns: String(input.maxTurns),
        allow_code: String(input.allowCode),
        allow_web: String(input.allowWeb),
        branch: input.branch,
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub no aceptó la tarea (${res.status}).`);
}

export interface WorkflowRun {
  id: number;
  url: string;
  status: string; // queued, in_progress, completed…
  conclusion: string | null; // success, failure, cancelled…
}

/** Busca la ejecución del workflow que corresponde a una ejecución de agente. */
export async function findWorkflowRun(runId: string, since: string): Promise<WorkflowRun | null> {
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
  const run = data.workflow_runs?.find((r) => r.display_title === workflowTitle(runId));
  return run ? { id: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion } : null;
}

export async function getWorkflowRun(id: number): Promise<WorkflowRun> {
  const res = await gh(`/actions/runs/${id}`);
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const r = (await res.json()) as { id: number; html_url: string; status: string; conclusion: string | null };
  return { id: r.id, url: r.html_url, status: r.status, conclusion: r.conclusion };
}

export async function cancelWorkflowRun(id: number): Promise<void> {
  await gh(`/actions/runs/${id}/cancel`, { method: "POST" });
}

export interface AgentArtifact {
  result: string;
  branchPushed: boolean;
}

/** Descarga el artefacto `agent-result` (result.md y meta.json) de una ejecución terminada. */
export async function downloadResult(id: number): Promise<AgentArtifact | null> {
  const res = await gh(`/actions/runs/${id}/artifacts`);
  if (!res.ok) return null;
  const data = (await res.json()) as { artifacts?: { name: string; archive_download_url: string; expired: boolean }[] };
  const artifact = data.artifacts?.find((a) => a.name === "agent-result" && !a.expired);
  if (!artifact) return null;
  const zip = await fetch(artifact.archive_download_url, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_AGENT_TOKEN}`, Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!zip.ok) return null;
  const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  const result = files["result.md"] ? strFromU8(files["result.md"]).trim() : "";
  let branchPushed = false;
  try {
    branchPushed = Boolean(files["meta.json"] && JSON.parse(strFromU8(files["meta.json"])).branch_pushed);
  } catch {
    // meta.json ilegible: sin rama
  }
  return { result, branchPushed };
}

/** Abre un PR de la rama del agente contra main. Devuelve su URL. */
export async function openPullRequest(branch: string, title: string, body: string): Promise<string> {
  const res = await gh(`/pulls`, {
    method: "POST",
    body: JSON.stringify({ head: branch, base: process.env.GITHUB_AGENT_REF || "main", title, body }),
  });
  if (!res.ok) throw new Error(`GitHub no abrió el PR (${res.status}).`);
  return ((await res.json()) as { html_url: string }).html_url;
}

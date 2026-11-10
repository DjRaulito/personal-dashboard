import { describe, expect, it } from "vitest";
import {
  agentBranch,
  agentFormSchema,
  claudeAgentPrompt,
  cleanTools,
  eurosToCents,
  findByName,
  freeSlots,
  geminiAgentSystem,
  isStale,
  MAX_CONCURRENT_RUNS,
  STARTER_AGENTS,
  statusAfterRun,
  taskFormSchema,
  workflowTitle,
} from "./catalog";

const RUN_ID = "3f2b8c1e-1111-4222-8333-444455556666";

describe("herramientas", () => {
  it("deja solo las del motor y sin repetir", () => {
    expect(cleanTools("gemini", ["nutricion", "codigo", "nutricion", "inventada"])).toEqual(["nutricion"]);
    expect(cleanTools("claude", ["codigo", "web", "agenda"])).toEqual(["codigo", "web"]);
  });

  it("los agentes de partida solo usan herramientas válidas", () => {
    for (const a of STARTER_AGENTS) expect(cleanTools(a.engine, a.tools)).toEqual(a.tools);
  });
});

describe("formularios", () => {
  it("valida la ficha de agente", () => {
    const ok = agentFormSchema.safeParse({ name: " Coach ", engine: "gemini", max_steps: "4", active: "on" });
    expect(ok.success && ok.data).toMatchObject({ name: "Coach", max_steps: 4, active: true, role: "" });
    expect(agentFormSchema.safeParse({ name: "", engine: "gemini", max_steps: "4" }).success).toBe(false);
    expect(agentFormSchema.safeParse({ name: "X", engine: "gpt", max_steps: "4" }).success).toBe(false);
    expect(agentFormSchema.safeParse({ name: "X", engine: "claude", max_steps: "11" }).success).toBe(false);
  });

  it("una tarea necesita texto y al menos un agente", () => {
    expect(taskFormSchema.safeParse({ prompt: "Resume mi semana", agents: [RUN_ID] }).success).toBe(true);
    expect(taskFormSchema.safeParse({ prompt: "Resume mi semana", agents: [] }).success).toBe(false);
    expect(taskFormSchema.safeParse({ prompt: "  ", agents: [RUN_ID] }).success).toBe(false);
  });
});

describe("cola", () => {
  it("respeta el límite de concurrencia", () => {
    expect(freeSlots(0)).toBe(MAX_CONCURRENT_RUNS);
    expect(freeSlots(MAX_CONCURRENT_RUNS)).toBe(0);
    expect(freeSlots(MAX_CONCURRENT_RUNS + 2)).toBe(0);
  });

  it("detecta ejecuciones colgadas según el motor", () => {
    const now = Date.parse("2026-11-11T10:00:00Z");
    const started_at = "2026-11-11T09:50:00Z"; // hace 10 minutos
    expect(isStale({ engine: "gemini", status: "working", started_at }, now)).toBe(true);
    expect(isStale({ engine: "claude", status: "working", started_at }, now)).toBe(false);
    expect(isStale({ engine: "gemini", status: "done", started_at }, now)).toBe(false);
    expect(isStale({ engine: "gemini", status: "working", started_at: null }, now)).toBe(false);
  });

  it("espera aprobación si hay propuestas", () => {
    expect(statusAfterRun(0)).toBe("done");
    expect(statusAfterRun(2)).toBe("waiting_approval");
  });

  it("nombra rama y workflow a partir de la ejecución", () => {
    expect(agentBranch(RUN_ID)).toBe("agents/3f2b8c1e");
    expect(workflowTitle(RUN_ID)).toBe(`agent-${RUN_ID}`);
  });
});

describe("instrucciones", () => {
  const agent = { name: "Coach", role: "Gym", instructions: "Sé breve.", tools: ["web"] };

  it("Gemini: fecha, instrucciones y aviso de propuestas solo si hay", () => {
    const withEffects = geminiAgentSystem(agent, "2026-11-11", "miércoles", true);
    expect(withEffects).toContain("«Coach»");
    expect(withEffects).toContain("miércoles 2026-11-11");
    expect(withEffects).toContain("Sé breve.");
    expect(withEffects).toContain("proponer_");
    expect(geminiAgentSystem(agent, "2026-11-11", "miércoles", false)).not.toContain("proponer_");
  });

  it("Claude: solo puede tocar código si tiene la herramienta", () => {
    expect(claudeAgentPrompt(agent, "Investiga X")).toContain("No modifiques archivos");
    const dev = claudeAgentPrompt({ ...agent, tools: ["codigo"] }, "Arregla Y");
    expect(dev).toContain("Puedes modificar el código");
    expect(dev.endsWith("Arregla Y")).toBe(true);
  });
});

describe("utilidades", () => {
  it("convierte euros a céntimos", () => {
    expect(eurosToCents(12.5)).toBe(1250);
    expect(eurosToCents("12,35")).toBe(1235);
    expect(eurosToCents("abc")).toBeNull();
  });

  it("busca por nombre sin tildes ni mayúsculas", () => {
    const items = [{ name: "Alimentación" }, { name: "Ocio" }, { name: "Vacaciones Japón" }];
    expect(findByName(items, "alimentacion")?.name).toBe("Alimentación");
    expect(findByName(items, "japon")?.name).toBe("Vacaciones Japón");
    expect(findByName(items, "")).toBeNull();
    expect(findByName(items, "coche")).toBeNull();
  });
});

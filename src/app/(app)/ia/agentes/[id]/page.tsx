import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AgentForm } from "@/components/agents/agent-form";
import { BackLink, Tile } from "@/components/ui";
import type { Engine } from "@/lib/agents/catalog";
import { getAgents } from "@/lib/agents/server";

export const metadata: Metadata = { title: "Agente" };

const NEW_AGENT = {
  name: "",
  role: "",
  instructions: "",
  engine: "gemini" as Engine,
  tools: [],
  max_steps: 6,
  active: true,
};

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "nuevo";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const agent = isNew ? null : (await getAgents()).find((a) => a.id === id);
  if (!isNew && !agent) notFound();

  return (
    <div className="flex flex-col gap-3.5">
      <BackLink href="/ia/agentes">Agentes</BackLink>
      <Tile>
        <h2 className="font-display mb-5 text-2xl font-bold">{agent ? agent.name : "Nuevo agente"}</h2>
        <AgentForm
          agent={
            agent
              ? {
                  id: agent.id,
                  name: agent.name,
                  role: agent.role,
                  instructions: agent.instructions,
                  engine: agent.engine as Engine,
                  tools: agent.tools,
                  max_steps: agent.max_steps,
                  active: agent.active,
                }
              : NEW_AGENT
          }
        />
      </Tile>
    </div>
  );
}

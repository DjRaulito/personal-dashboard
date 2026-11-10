import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrainExplorer } from "@/components/brain/brain-explorer";
import { LiveBrain } from "@/components/brain/live-brain";
import { ForgetAllButton, TokenManager } from "@/components/brain/token-manager";
import { Tile, TileTitle } from "@/components/ui";
import { MAX_GRAPH_NODES } from "@/lib/brain/schemas";
import { getBrain } from "@/lib/brain/server";

export const metadata: Metadata = { title: "Cerebro" };
export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const [brain, h] = await Promise.all([getBrain(MAX_GRAPH_NODES), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/brain/mcp`;

  return (
    <div className="flex flex-col gap-3.5">
      <LiveBrain />
      <Tile>
        <TileTitle dot="bg-content">Memoria</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Lo que tus IAs saben de ti y de tus proyectos. Se actualiza en directo cuando una IA guarda algo.
        </p>
        <div className="mt-5">
          <BrainExplorer nodes={brain.nodes} links={brain.links} total={brain.total} />
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-content">Conectar IAs</TileTitle>
        <p className="text-muted mt-1 mb-5 text-sm">
          Un token por IA. Puedes revocarlo cuando quieras sin tocar el resto.
        </p>
        <TokenManager endpoint={endpoint} tokens={brain.tokens} />
      </Tile>

      <Tile>
        <TileTitle dot="bg-expense">Borrar</TileTitle>
        <p className="text-muted mt-1 mb-4 text-sm">
          Borra todos los recuerdos al instante. Los tokens se mantienen; revócalos arriba si quieres cortar el acceso.
        </p>
        <ForgetAllButton disabled={brain.total === 0} />
      </Tile>
    </div>
  );
}

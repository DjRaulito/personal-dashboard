import type { Metadata } from "next";
import Link from "next/link";
import { BrainExplorer } from "@/components/brain/brain-explorer";
import { LiveBrain } from "@/components/brain/live-brain";
import { PageShell, SectionHead } from "@/components/page-header";
import { Tile, TileTitle } from "@/components/ui";
import { MAX_GRAPH_NODES } from "@/lib/brain/schemas";
import { getBrain } from "@/lib/brain/server";

export const metadata: Metadata = { title: "Cerebro" };
export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const brain = await getBrain(MAX_GRAPH_NODES);

  return (
    <PageShell>
      <SectionHead title="Cerebro" tabs={<p className="text-muted text-sm">La memoria que comparten tus IAs</p>} />
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

      <p className="text-muted text-sm">
        Los tokens de acceso de tus IAs están en{" "}
        <Link href="/ajustes/conexiones" className="text-text underline underline-offset-4">
          Ajustes → Conexiones
        </Link>{" "}
        y el borrado de todos los recuerdos en{" "}
        <Link href="/ajustes/datos" className="text-text underline underline-offset-4">
          Ajustes → Datos
        </Link>
        .
      </p>
    </PageShell>
  );
}

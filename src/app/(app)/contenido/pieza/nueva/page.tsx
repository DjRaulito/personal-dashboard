import type { Metadata } from "next";
import { PieceForm } from "@/components/content/piece-form";
import { BackLink, Tile, TileTitle } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/llm";

export const metadata: Metadata = { title: "Nueva pieza · Contenido" };
export const dynamic = "force-dynamic";

export default function NewPiecePage() {
  return (
    <>
      <BackLink href="/contenido">Tablero</BackLink>
      <Tile>
        <TileTitle dot="bg-content">Nueva pieza</TileTitle>
        <div className="mt-5">
          <PieceForm
            aiReady={aiConfigured()}
            piece={{
              title: "",
              status: "idea",
              format: "short",
              platforms: [],
              priority: 2,
              tags: [],
              script: "",
              notes: "",
              links: [],
              publish_at: "",
              published_url: "",
            }}
          />
        </div>
      </Tile>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { OutfitList } from "@/components/wardrobe/outfit-list";
import { EmptyState, Tile } from "@/components/ui";
import { getGarments, getOutfits } from "@/lib/wardrobe/server";

export const metadata: Metadata = { title: "Outfits · Armario" };

export default async function OutfitsPage() {
  const [outfits, garments] = await Promise.all([getOutfits(), getGarments()]);
  if (outfits.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Aún no has guardado ningún outfit. Monta uno en el{" "}
          <Link href="/armario" className="text-text underline underline-offset-4">
            Probador
          </Link>{" "}
          o pide ideas al estilista.
        </EmptyState>
      </Tile>
    );
  }
  return <OutfitList outfits={outfits} garments={garments} />;
}

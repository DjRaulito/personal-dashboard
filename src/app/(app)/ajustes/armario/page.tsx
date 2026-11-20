import type { Metadata } from "next";
import { CityForm } from "@/components/wardrobe/city-form";
import { Tile, TileTitle } from "@/components/ui";
import { getWardrobeSettings } from "@/lib/wardrobe/server";

export const metadata: Metadata = { title: "Armario · Ajustes" };

export default async function WardrobeSettingsPage() {
  const settings = await getWardrobeSettings();
  return (
    <Tile>
      <TileTitle dot="bg-wardrobe">El tiempo</TileTitle>
      <p className="text-muted mt-1 text-sm">
        Los outfits tienen en cuenta el tiempo de hoy en tu ciudad (Open-Meteo, gratis y sin clave).
        {settings.city ? ` Ahora: ${settings.city}.` : ""}
      </p>
      <div className="mt-4 max-w-md">
        <CityForm city={settings.city} />
      </div>
    </Tile>
  );
}

import type { Metadata } from "next";
import { FittingRoom } from "@/components/wardrobe/fitting-room";
import { getGarments, getOutfits, getTodayWeather, getWardrobeSettings } from "@/lib/wardrobe/server";

export const metadata: Metadata = { title: "Armario" };
// La IA del estilista puede tardar si un proveedor falla y se pasa al siguiente
export const maxDuration = 60;

export default async function WardrobePage({ searchParams }: { searchParams: Promise<{ outfit?: string }> }) {
  const [{ outfit: outfitId }, garments, settings] = await Promise.all([
    searchParams,
    getGarments(),
    getWardrobeSettings(),
  ]);
  const [weather, outfits] = await Promise.all([getTodayWeather(settings), outfitId ? getOutfits() : []]);
  const outfit = outfits.find((o) => o.id === outfitId);
  return (
    <FittingRoom
      key={outfit?.id ?? "libre"}
      garments={garments}
      initialIds={outfit?.garmentIds ?? null}
      weather={weather}
      city={settings.city}
    />
  );
}

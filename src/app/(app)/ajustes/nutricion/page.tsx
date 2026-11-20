import type { Metadata } from "next";
import { ReviewSheetForm } from "@/components/nutrition/reviews";
import { Tile, TileTitle } from "@/components/ui";
import { getNutritionSettings } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Nutrición · Ajustes" };

export default async function NutritionSettingsPage() {
  const settings = await getNutritionSettings();
  return (
    <Tile>
      <TileTitle dot="bg-nutrition">Hoja de control</TileTitle>
      <p className="text-muted mt-1 text-sm">
        {settings.sheetId
          ? "Las revisiones (peso y perímetros) se leen de esta hoja de Google. Pega otro enlace para cambiarla."
          : "Indica la hoja de cálculo de Google donde tu nutricionista apunta el peso y las medidas."}
      </p>
      <div className="mt-4 max-w-xl">
        <ReviewSheetForm configured={Boolean(settings.sheetId)} />
      </div>
    </Tile>
  );
}

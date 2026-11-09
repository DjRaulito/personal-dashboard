import type { Metadata } from "next";
import { FoodActions, FoodForm } from "@/components/nutrition/forms";
import { LoadCatalogButton } from "@/components/nutrition/setup";
import { Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE } from "@/lib/datetime";
import { getFoods } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Alimentos · Nutrición" };

const num = (v: number) => v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 1 });

export default async function FoodsPage() {
  const foods = await getFoods();
  const byId = new Map(foods.map((f) => [f.id, f]));
  const rawFoods = foods.filter((f) => !f.cooked_from).map((f) => ({ id: f.id, name: f.name }));
  return (
    <>
      <Tile>
        <TileTitle dot="bg-nutrition">Nuevo alimento</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Valores por 100 g (o 100 ml) tal y como lo pesas. Escribe el nombre y pulsa “Rellenar macros con IA” si no
          tienes la etiqueta.
        </p>
        <div className="mt-4">
          <FoodForm rawFoods={rawFoods} />
        </div>
      </Tile>
      <Tile className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <TileTitle dot="bg-nutrition">Tus alimentos ({foods.length})</TileTitle>
          <LoadCatalogButton label="Añadir los básicos que falten" />
        </div>
        <ul className="mt-3">
          {foods.map((f) => (
            <li key={f.id} className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.name}</p>
                <p className="text-muted text-xs tabular-nums">
                  {num(f.kcal)} kcal · P {num(f.protein_g)} · HC {num(f.carbs_g)} · G {num(f.fat_g)}
                  {f.unit_label && f.unit_grams && ` · 1 ${f.unit_label} = ${num(f.unit_grams)} g`}
                  {f.cooked_from &&
                    f.cooked_factor &&
                    ` · cocido de ${byId.get(f.cooked_from)?.name ?? "?"} (×${num(f.cooked_factor)})`}
                </p>
              </div>
              <FoodActions food={f} rawFoods={rawFoods} />
            </li>
          ))}
        </ul>
      </Tile>
    </>
  );
}

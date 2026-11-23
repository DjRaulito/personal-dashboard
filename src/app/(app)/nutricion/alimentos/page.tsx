import type { Metadata } from "next";
import { FoodBrowser } from "@/components/nutrition/food-browser";
import { FoodForm } from "@/components/nutrition/forms";
import { LoadCatalogButton } from "@/components/nutrition/setup";
import { Tile } from "@/components/ui";
import { getActivePlan, getFoods } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Alimentos · Nutrición" };

export default async function FoodsPage() {
  const [foods, plan] = await Promise.all([getFoods(), getActivePlan()]);
  // Alimentos de cada comida del plan activo (para filtrar por comida)
  const meals = (plan?.meals ?? [])
    .map((m) => ({ id: m.id, name: m.name, foodIds: m.groups.flatMap((g) => g.options.map((o) => o.food_id)) }))
    .filter((m) => m.foodIds.length > 0);
  const rawFoods = foods.filter((f) => !f.cooked_from).map((f) => ({ id: f.id, name: f.name }));
  return (
    <>
      <FoodBrowser foods={foods} meals={meals} />
      <Tile>
        <details>
          <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold">
            <span aria-hidden="true" className="bg-nutrition h-2.5 w-2.5 rounded-full" />
            Añadir un alimento
            <span className="text-muted ml-auto text-sm font-normal">Abrir</span>
          </summary>
          <p className="text-muted mt-3 text-sm">
            Valores por 100 g (o 100 ml) tal y como lo pesas. Escribe el nombre y pulsa “Rellenar macros con IA” si no
            tienes la etiqueta.
          </p>
          <div className="mt-4">
            <FoodForm rawFoods={rawFoods} />
          </div>
          <div className="mt-4">
            <LoadCatalogButton label="Añadir los básicos que falten" />
          </div>
        </details>
      </Tile>
    </>
  );
}

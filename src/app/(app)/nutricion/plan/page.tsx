import type { Metadata } from "next";
import { PlanEditor } from "@/components/nutrition/plan-editor";
import { CreatePlanForm, LoadCatalogButton } from "@/components/nutrition/setup";
import { Tile, TileTitle } from "@/components/ui";
import { getActivePlan, getFoods } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Plan · Nutrición" };

export default async function PlanPage() {
  const [plan, foods] = await Promise.all([getActivePlan(), getFoods()]);
  if (foods.length === 0) {
    return (
      <Tile>
        <TileTitle dot="bg-nutrition">Primero, los alimentos</TileTitle>
        <p className="text-muted mt-2 text-sm">Carga los alimentos básicos para poder montar el plan.</p>
        <div className="mt-4">
          <LoadCatalogButton />
        </div>
      </Tile>
    );
  }
  return (
    <>
      {plan ? (
        <PlanEditor plan={plan} foods={foods} />
      ) : (
        <Tile>
          <TileTitle dot="bg-nutrition">Crea tu plan</TileTitle>
          <p className="text-muted mt-2 text-sm">
            Después añade cada comida, sus grupos y las opciones con sus gramos.
          </p>
          <div className="mt-4">
            <CreatePlanForm />
          </div>
        </Tile>
      )}
    </>
  );
}

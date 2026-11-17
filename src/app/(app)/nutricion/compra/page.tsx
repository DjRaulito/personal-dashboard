import type { Metadata } from "next";
import { ShoppingPlanner } from "@/components/nutrition/shopping-planner";
import { EmptyState, Tile } from "@/components/ui";
import { getActivePlan, getFoods, getShoppingPicks } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Compra · Nutrición" };

export default async function ShoppingPage() {
  const [plan, foods, picks] = await Promise.all([getActivePlan(), getFoods(), getShoppingPicks()]);
  if (!plan) {
    return (
      <Tile>
        <EmptyState>Crea primero tu plan en la pestaña Plan.</EmptyState>
      </Tile>
    );
  }
  return <ShoppingPlanner meals={plan.meals} foodList={foods} initialPicks={Object.fromEntries(picks)} />;
}

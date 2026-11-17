import type { Metadata } from "next";
import { ChefPanel } from "@/components/nutrition/chef-panel";
import { EmptyState, Tile } from "@/components/ui";
import { getActivePlan, getFoods } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Chef · Nutrición" };

export default async function ChefPage() {
  const [plan, foods] = await Promise.all([getActivePlan(), getFoods()]);
  if (!plan) {
    return (
      <Tile>
        <EmptyState>Crea primero tu plan en la pestaña Plan.</EmptyState>
      </Tile>
    );
  }
  return <ChefPanel meals={plan.meals} foodList={foods} />;
}

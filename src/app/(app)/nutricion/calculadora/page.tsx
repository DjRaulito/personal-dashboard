import type { Metadata } from "next";
import { PortionCalculator } from "@/components/nutrition/portion-calculator";
import { EmptyState, Tile } from "@/components/ui";
import { getActivePlan, getFoods } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Calculadora · Nutrición" };

export default async function CalculatorPage() {
  const [plan, foods] = await Promise.all([getActivePlan(), getFoods()]);
  if (!plan) {
    return (
      <Tile>
        <EmptyState>Crea primero tu plan en la pestaña Plan.</EmptyState>
      </Tile>
    );
  }
  return <PortionCalculator meals={plan.meals} foodList={foods} />;
}

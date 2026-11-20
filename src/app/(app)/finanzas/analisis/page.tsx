import type { Metadata } from "next";
import { IncomeSection } from "@/components/finance/income-section";
import { MetricsSection } from "@/components/finance/metrics-section";
import { PlanSection } from "@/components/finance/plan-section";

export const metadata: Metadata = { title: "Análisis · Finanzas" };

// Salario frente a gastos y apuestas arriba; plan (presupuestos, objetivos y pagos fijos) y métricas debajo
export default function AnalysisPage() {
  return (
    <>
      <IncomeSection />
      <PlanSection />
      <h2 className="mt-4 text-2xl font-bold">Métricas</h2>
      <MetricsSection />
    </>
  );
}

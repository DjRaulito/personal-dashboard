import type { Metadata } from "next";
import { MetricsSection } from "@/components/finance/metrics-section";
import { PlanSection } from "@/components/finance/plan-section";

export const metadata: Metadata = { title: "Análisis · Finanzas" };

// Plan (presupuestos, objetivos y pagos fijos) arriba y métricas debajo
export default function AnalysisPage() {
  return (
    <>
      <PlanSection />
      <h2 className="mt-4 text-2xl font-bold">Métricas</h2>
      <MetricsSection />
    </>
  );
}

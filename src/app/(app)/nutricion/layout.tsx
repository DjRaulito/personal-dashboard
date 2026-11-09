import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { PageShell } from "@/components/page-header";

export default function NutritionLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <h1 className="sr-only">Nutrición</h1>
      <NutritionNav />
      {children}
    </PageShell>
  );
}

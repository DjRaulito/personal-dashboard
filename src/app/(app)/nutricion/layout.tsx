import { PageShell, SectionHead } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/nutricion", label: "Plan", exact: true, also: ["/nutricion/plan"] },
  { href: "/nutricion/calculadora", label: "Calculadora" },
  { href: "/nutricion/chef", label: "Chef" },
  { href: "/nutricion/revisiones", label: "Revisiones" },
  { href: "/nutricion/alimentos", label: "Alimentos" },
  { href: "/nutricion/cheats", label: "Cheat meals" },
  { href: "/nutricion/compra", label: "Compra" },
];

export default function NutritionLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <SectionHead title="Nutrición" tabs={<SectionTabs label="Nutrición" tabs={TABS} />} />
      {children}
    </PageShell>
  );
}

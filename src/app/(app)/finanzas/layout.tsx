import { PageShell, SectionHead } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/finanzas", label: "Patrimonio", exact: true },
  { href: "/finanzas/gastos", label: "Gastos", also: ["/finanzas/movimientos"] },
  { href: "/finanzas/analisis", label: "Análisis" },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <SectionHead title="Finanzas" tabs={<SectionTabs label="Finanzas" tabs={TABS} />} />
      {children}
    </PageShell>
  );
}

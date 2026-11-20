import { PageShell, SectionHead } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/inversiones", label: "Resumen", exact: true },
  { href: "/inversiones/posiciones", label: "Posiciones", also: ["/inversiones/importar"] },
  { href: "/inversiones/rentabilidad", label: "Rentabilidad" },
];

export default function InvestmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <SectionHead title="Inversiones" tabs={<SectionTabs label="Inversiones" tabs={TABS} />} />
      {children}
    </PageShell>
  );
}

import { PageShell, SectionHead } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/armario", label: "Hoy", exact: true },
  { href: "/armario/combina", label: "¿Combina?" },
  { href: "/armario/prendas", label: "Prendas" },
  { href: "/armario/outfits", label: "Outfits" },
];

export default function WardrobeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <SectionHead title="Armario" tabs={<SectionTabs label="Armario" tabs={TABS} />} />
      {children}
    </PageShell>
  );
}

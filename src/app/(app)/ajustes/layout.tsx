import { PageShell, SectionHead } from "@/components/page-header";
import { SettingsNav } from "@/components/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <SectionHead
        title="Ajustes"
        tabs={<p className="text-muted text-sm">Cómo funciona la app. El contenido se crea en cada sección.</p>}
      />
      <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
        <SettingsNav />
        <div className="flex min-w-0 flex-col gap-3.5">{children}</div>
      </div>
    </PageShell>
  );
}

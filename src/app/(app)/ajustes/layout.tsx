import { PageShell, SectionHead } from "@/components/page-header";
import { SettingsNav } from "@/components/settings-nav";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  return (
    <PageShell>
      <SectionHead
        title="Ajustes"
        tabs={<p className="text-muted text-sm">Cómo funciona la app. El contenido se crea en cada sección.</p>}
      />
      <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
        <SettingsNav admin={Boolean(admin)} />
        <div className="flex min-w-0 flex-col gap-3.5">{children}</div>
      </div>
    </PageShell>
  );
}

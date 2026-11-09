import { PageHeader, PageShell } from "@/components/page-header";
import { MODULES, type ModuleKey } from "@/lib/modules";

/** Página de un módulo que aún no está construido. */
export function ComingSoon({ moduleKey }: { moduleKey: ModuleKey }) {
  const m = MODULES.find((x) => x.key === moduleKey)!;
  return (
    <PageShell>
      <PageHeader title={m.label} subtitle={m.description} />
      <section className="rounded-tile border-border bg-surface flex items-center gap-4 border p-6">
        <span aria-hidden="true" className={`h-10 w-10 shrink-0 rounded-xl ${m.color}`} />
        <p className="text-muted">Este módulo llega en la fase {m.phase}.</p>
      </section>
    </PageShell>
  );
}

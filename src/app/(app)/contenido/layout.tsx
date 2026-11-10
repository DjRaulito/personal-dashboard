import { ContentNav } from "@/components/content/content-nav";
import { PageShell } from "@/components/page-header";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <h1 className="sr-only">Contenido</h1>
      <ContentNav />
      {children}
    </PageShell>
  );
}

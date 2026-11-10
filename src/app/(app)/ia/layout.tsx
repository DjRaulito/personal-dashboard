import { IaNav } from "@/components/ai/ia-nav";
import { PageShell } from "@/components/page-header";

export default function IaLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <h1 className="sr-only">IA</h1>
      <IaNav />
      {children}
    </PageShell>
  );
}

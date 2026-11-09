import { FinanceNav } from "@/components/finance/finance-nav";
import { PageShell } from "@/components/page-header";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <FinanceNav />
      {children}
    </PageShell>
  );
}

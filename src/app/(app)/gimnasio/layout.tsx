import { GymNav } from "@/components/gym/gym-nav";
import { PageShell } from "@/components/page-header";

export default function GymLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <h1 className="sr-only">Gimnasio</h1>
      <GymNav />
      {children}
    </PageShell>
  );
}

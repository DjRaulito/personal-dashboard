import { PageShell } from "@/components/page-header";
import { WardrobeNav } from "@/components/wardrobe/wardrobe-nav";

export default function WardrobeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <h1 className="sr-only">Armario</h1>
      <WardrobeNav />
      {children}
    </PageShell>
  );
}

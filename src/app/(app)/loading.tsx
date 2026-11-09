import { PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui";

// Se muestra al instante mientras el servidor prepara la página
export default function Loading() {
  return (
    <PageShell>
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-3.5 md:grid-cols-6">
        <Skeleton className="rounded-tile h-56 md:col-span-4" />
        <Skeleton className="rounded-tile h-56 md:col-span-2" />
        <Skeleton className="rounded-tile h-36 md:col-span-2" />
        <Skeleton className="rounded-tile h-36 md:col-span-2" />
        <Skeleton className="rounded-tile h-36 md:col-span-2" />
      </div>
    </PageShell>
  );
}

import { Skeleton } from "@/components/ui";

// Dentro del layout de Finanzas: las pestañas se quedan y solo carga el contenido
export default function Loading() {
  return (
    <>
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="rounded-tile h-40 sm:col-span-2" />
        <Skeleton className="rounded-tile h-40" />
        <Skeleton className="rounded-tile h-40" />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-5">
        <Skeleton className="rounded-tile h-72 lg:col-span-3" />
        <Skeleton className="rounded-tile h-72 lg:col-span-2" />
      </div>
      <Skeleton className="rounded-tile h-64" />
    </>
  );
}

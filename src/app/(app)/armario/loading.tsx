import { Skeleton } from "@/components/ui";

// Dentro del layout del Armario: las pestañas se quedan y solo carga el contenido
export default function Loading() {
  return (
    <>
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <div className="grid gap-3.5 lg:grid-cols-5">
        <Skeleton className="rounded-tile h-[32rem] lg:col-span-3" />
        <Skeleton className="rounded-tile h-[32rem] lg:col-span-2" />
      </div>
    </>
  );
}

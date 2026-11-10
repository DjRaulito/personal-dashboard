import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <Skeleton className="rounded-tile h-96" />
    </>
  );
}

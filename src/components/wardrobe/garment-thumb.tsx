import { clsx } from "clsx";
import { Shirt } from "lucide-react";
import type { Garment } from "@/lib/wardrobe/types";

/** Miniatura cuadrada de una prenda (o un hueco si su foto no está disponible). */
export function GarmentThumb({ garment, className }: { garment: Garment | undefined; className?: string }) {
  return (
    <span
      className={clsx(
        "bg-surface-2 rounded-inner flex shrink-0 items-center justify-center overflow-hidden",
        className ?? "h-12 w-12",
      )}
    >
      {garment?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado y temporal
        <img
          src={garment.url}
          alt=""
          loading="lazy"
          draggable={false}
          className={clsx("h-full w-full", garment.cutout ? "object-contain p-1" : "object-cover")}
        />
      ) : (
        <Shirt aria-hidden="true" className="text-muted h-5 w-5" strokeWidth={1.5} />
      )}
    </span>
  );
}

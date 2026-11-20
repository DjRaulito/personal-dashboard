import { clsx } from "clsx";
import { Shirt } from "lucide-react";
import { colorText } from "@/lib/wardrobe/colors";
import { CATEGORY_LABELS, type Garment } from "@/lib/wardrobe/types";

function Piece({ garment, className }: { garment: Garment; className?: string }) {
  return (
    <div
      className={clsx(
        "bg-surface-2 rounded-inner relative flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {garment.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado y temporal
        <img
          src={garment.url}
          alt=""
          draggable={false}
          className={clsx("h-full w-full", garment.cutout ? "object-contain p-2" : "object-cover")}
        />
      ) : (
        <Shirt aria-hidden="true" className="text-muted h-8 w-8" strokeWidth={1.25} />
      )}
    </div>
  );
}

/**
 * Un conjunto «en plano», como extendido sobre la cama: abrigo y parte de arriba a la izquierda,
 * pantalón a la derecha, calzado y accesorios abajo. Debajo, cada prenda con sus colores en palabras.
 */
export function OutfitCollage({ garments, size = "lg" }: { garments: Garment[]; size?: "lg" | "sm" }) {
  const by = (c: Garment["category"]) => garments.filter((g) => g.category === c);
  const [outer] = by("outerwear");
  const [top] = by("top");
  const [bottom] = by("bottom");
  const [shoes] = by("shoes");
  const accessories = by("accessory");
  const big = size === "lg";
  return (
    <figure className="flex flex-col gap-3">
      <div className={clsx("grid grid-cols-2 gap-2", big ? "min-h-[18rem]" : "min-h-[9rem]")}>
        <div className="flex flex-col gap-2">
          {outer && <Piece garment={outer} className={big ? "aspect-[4/3]" : "aspect-square"} />}
          {top && <Piece garment={top} className={clsx("flex-1", big ? "min-h-40" : "min-h-16")} />}
        </div>
        <div className="flex flex-col gap-2">
          {bottom && <Piece garment={bottom} className={clsx("flex-1", big ? "min-h-48" : "min-h-20")} />}
          {(shoes || accessories.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {shoes && <Piece garment={shoes} className="col-span-2 aspect-[2/1]" />}
              {accessories.slice(0, shoes ? 1 : 3).map((a) => (
                <Piece key={a.id} garment={a} className="aspect-square" />
              ))}
            </div>
          )}
        </div>
      </div>
      <figcaption>
        <ul className={clsx("flex flex-col", big ? "gap-1.5 text-sm" : "gap-0.5 text-xs")}>
          {garments.map((g) => (
            <li key={g.id} className="flex flex-wrap gap-x-2">
              <span className="font-semibold">{g.name}</span>
              <span className="text-muted">
                {CATEGORY_LABELS[g.category].toLowerCase()} · {g.colorDetails.map(colorText).join(" / ") || "sin color"}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

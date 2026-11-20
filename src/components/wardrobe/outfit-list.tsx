"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Check, Star, Trash2 } from "lucide-react";
import { deleteOutfit, toggleFavorite, wearToday } from "@/app/(app)/armario/actions";
import { buttonClass } from "@/components/ui";
import { OCCASION_LABELS, type Garment, type Outfit } from "@/lib/wardrobe/types";
import { OutfitCollage } from "./outfit-collage";

function OutfitCard({ outfit, byId }: { outfit: Outfit; byId: Map<string, Garment> }) {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const garments = outfit.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => !!g);
  return (
    <li className="rounded-tile border-border bg-surface flex flex-col gap-3 border p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{outfit.name}</h2>
          {outfit.occasion && <p className="text-muted text-xs">{OCCASION_LABELS[outfit.occasion]}</p>}
        </div>
        <button
          type="button"
          aria-pressed={outfit.favorite}
          aria-label={outfit.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
          disabled={pending}
          onClick={() => start(() => toggleFavorite(outfit.id, !outfit.favorite))}
          className="hover:bg-surface-2 rounded-full p-2"
        >
          <Star
            aria-hidden="true"
            className={clsx("h-5 w-5", outfit.favorite ? "fill-attention text-attention" : "text-muted")}
          />
        </button>
      </div>
      <OutfitCollage garments={garments} size="sm" />
      {outfit.note && <p className="text-muted text-sm">{outfit.note}</p>}
      {message && (
        <p role="status" className="text-finance text-sm">
          ✓ {message}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await wearToday(outfit.garmentIds);
              setMessage(r.message);
            })
          }
          className={buttonClass.secondary}
        >
          <Check aria-hidden="true" className="h-4 w-4" /> Me lo pongo
        </button>
        <button
          type="button"
          disabled={pending}
          className={`${buttonClass.danger} ml-auto`}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            start(() => deleteOutfit(outfit.id));
          }}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          {confirm ? "¿Seguro? Borrar" : "Borrar"}
        </button>
      </div>
    </li>
  );
}

/** Outfits guardados; los favoritos primero (los ordena el servidor). */
export function OutfitList({ outfits, garments }: { outfits: Outfit[]; garments: Garment[] }) {
  const byId = new Map(garments.map((g) => [g.id, g]));
  return (
    <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {outfits.map((o) => (
        <OutfitCard key={o.id} outfit={o} byId={byId} />
      ))}
    </ul>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteOutfit } from "@/app/(app)/armario/actions";
import { buttonClass } from "@/components/ui";
import { OCCASION_LABELS, type Garment, type Outfit } from "@/lib/wardrobe/types";
import { GarmentThumb } from "./garment-thumb";

function OutfitCard({ outfit, byId }: { outfit: Outfit; byId: Map<string, Garment> }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const garments = outfit.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => !!g);
  return (
    <li className="rounded-tile border-border bg-surface flex flex-col gap-3 border p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{outfit.name}</h2>
          {outfit.occasion && <p className="text-muted text-xs">{OCCASION_LABELS[outfit.occasion]}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {garments.map((g) => (
          <GarmentThumb key={g.id} garment={g} className="h-16 w-16" />
        ))}
      </div>
      <p className="text-muted text-xs">{garments.map((g) => g.name).join(" · ")}</p>
      {outfit.note && <p className="text-muted text-sm">{outfit.note}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link href={`/armario?outfit=${outfit.id}`} className={buttonClass.secondary}>
          Ver en el probador
        </Link>
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

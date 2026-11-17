import type { Metadata } from "next";
import { TryOnStudio } from "@/components/wardrobe/try-on";
import { getGarments, getTryOnState } from "@/lib/wardrobe/server";
import { tryOnConfigured } from "@/lib/wardrobe/tryon";
import { TRYON_PARTS } from "@/lib/wardrobe/types";

export const metadata: Metadata = { title: "Probar en mí · Armario" };
// Cola del servicio + una o dos generaciones (arriba y abajo)
export const maxDuration = 300;

export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ arriba?: string; abajo?: string }>;
}) {
  const [{ arriba, abajo }, garments, state] = await Promise.all([searchParams, getGarments(), getTryOnState()]);
  const tryable = garments.filter((g) => g.category in TRYON_PARTS);
  const pick = (id: string | undefined, part: "upper_body" | "lower_body") =>
    tryable.find((g) => g.id === id && TRYON_PARTS[g.category as keyof typeof TRYON_PARTS] === part)?.id ?? null;
  return (
    <TryOnStudio
      garments={tryable}
      personUrl={state.personUrl}
      results={state.results}
      initialUpper={pick(arriba, "upper_body")}
      initialLower={pick(abajo, "lower_body")}
      configured={tryOnConfigured()}
    />
  );
}

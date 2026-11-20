"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Check, RefreshCw, Shirt, Sparkles, Star } from "lucide-react";
import { saveOutfit, suggestOutfits, wearToday } from "@/app/(app)/armario/actions";
import { buttonClass, EmptyState, Field, FormMessage, inputClass, Tile, TileTitle } from "@/components/ui";
import { weatherLine, type ResolvedOutfit, type Weather } from "@/lib/wardrobe/ai";
import type { Garment } from "@/lib/wardrobe/types";
import { OutfitCollage } from "./outfit-collage";

/** Armario → Hoy: el tiempo, el plan del día y un outfit grande con «Otra opción» y «Me lo pongo». */
export function WardrobeToday({
  garments,
  weather,
  city,
  planHint,
  aiReady,
}: {
  garments: Garment[];
  weather: Weather | null;
  city: string | null;
  planHint: string;
  aiReady: boolean;
}) {
  const [plan, setPlan] = useState(planHint);
  const [useWeather, setUseWeather] = useState(Boolean(weather));
  const [outfits, setOutfits] = useState<ResolvedOutfit[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<{ ok: boolean; message?: string }>({ ok: true });
  const [thinking, think] = useTransition();
  const [acting, act] = useTransition();
  const byId = new Map(garments.map((g) => [g.id, g]));
  const current = outfits[index];
  const pieces = current ? current.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => !!g) : [];

  function ask() {
    setError(null);
    setState({ ok: true });
    think(async () => {
      const r = await suggestOutfits({ plan, pinId: null, useWeather });
      if (!r.ok) return setError(r.message);
      setOutfits(r.data);
      setIndex(0);
    });
  }

  function another() {
    setState({ ok: true });
    if (index + 1 < outfits.length) setIndex(index + 1);
    else ask();
  }

  if (garments.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Tu armario está vacío.{" "}
          <Link href="/armario/prendas" className="text-text underline underline-offset-4">
            Sube fotos de tus prendas
          </Link>{" "}
          y aquí te propondré qué ponerte cada día.
        </EmptyState>
      </Tile>
    );
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-5">
      <Tile className="lg:col-span-2">
        <TileTitle dot="bg-wardrobe">¿Qué me pongo?</TileTitle>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <Field label="¿Qué vas a hacer hoy?">
            <input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              maxLength={200}
              placeholder="Cena con amigos, entrevista, oficina…"
              className={inputClass}
            />
          </Field>
          {planHint && plan === planHint && (
            <p className="text-muted -mt-2 text-xs">Sacado de tu calendario de hoy. Cámbialo si quieres.</p>
          )}
          <div className="bg-surface-2 rounded-inner flex flex-col gap-2 px-4 py-3 text-sm">
            {weather ? (
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={useWeather}
                  onChange={(e) => setUseWeather(e.target.checked)}
                  className="accent-wardrobe mt-0.5 h-4 w-4"
                />
                <span>
                  Tener en cuenta el tiempo
                  <span className="text-muted block text-xs">
                    {weatherLine(weather)} · {city}
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-muted">
                {city ? `No se ha podido consultar el tiempo de ${city} ahora.` : "Sin ciudad: no se mira el tiempo."}
              </p>
            )}
            <Link
              href="/ajustes/armario"
              className="text-muted hover:text-text self-start text-xs underline underline-offset-4"
            >
              {city ? "Cambiar de ciudad" : "Indicar mi ciudad"}
            </Link>
          </div>
          <button type="submit" disabled={thinking || !aiReady} className={clsx(buttonClass.primary, "self-start")}>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            {thinking ? "Pensando…" : outfits.length ? "Proponer otros" : "Proponer outfits"}
          </button>
          {!aiReady && <p className="text-muted text-xs">Falta configurar la IA (Ajustes → Conexiones).</p>}
          {error && (
            <p role="alert" className="bg-surface-2 rounded-inner text-attention px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}
        </form>
      </Tile>

      <Tile className="lg:col-span-3">
        {current ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-bold">{current.name}</h2>
              <span className="text-muted text-xs tabular-nums">
                Opción {index + 1} de {outfits.length}
              </span>
            </div>
            <OutfitCollage garments={pieces} />
            {current.why && <p className="text-sm">{current.why}</p>}
            {current.notes.map((n) => (
              <p key={n} className="text-attention text-sm">
                ! {n}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={acting}
                onClick={() => act(async () => setState(await wearToday(current.garmentIds)))}
                className={buttonClass.primary}
              >
                <Check aria-hidden="true" className="h-4 w-4" /> Me lo pongo
              </button>
              <button type="button" disabled={thinking} onClick={another} className={buttonClass.secondary}>
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Otra opción
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() =>
                  act(async () =>
                    setState(
                      await saveOutfit({
                        name: current.name,
                        occasion: null,
                        note: current.why || null,
                        garmentIds: current.garmentIds,
                      }),
                    ),
                  )
                }
                className={buttonClass.secondary}
              >
                <Star aria-hidden="true" className="h-4 w-4" /> Guardar
              </button>
            </div>
            <FormMessage state={state} />
          </div>
        ) : (
          <div className="text-muted flex min-h-64 flex-col items-center justify-center gap-3 text-center text-sm">
            <Shirt aria-hidden="true" className="h-10 w-10" strokeWidth={1.25} />
            <p className="max-w-sm">
              Dime qué vas a hacer y te propongo hasta tres outfits con tu ropa, con cada color dicho en palabras y
              comprobado con reglas de combinación.
            </p>
          </div>
        )}
      </Tile>
    </div>
  );
}

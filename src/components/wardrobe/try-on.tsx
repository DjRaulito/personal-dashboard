"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Camera, ImagePlus, Trash2, UserRound } from "lucide-react";
import { deletePersonPhoto, deleteTryOn, savePersonPhoto, tryOn } from "@/app/(app)/armario/actions";
import { buttonClass, EmptyState, FormMessage, Tile, TileTitle } from "@/components/ui";
import type { FormState } from "@/lib/finance/schemas";
import { resizeImage } from "@/lib/image-resize";
import type { TryOnResult } from "@/lib/wardrobe/server";
import { CATEGORY_LABELS, TRYON_PARTS, type Garment } from "@/lib/wardrobe/types";
import { GarmentThumb } from "./garment-thumb";

const partOf = (g: Garment) => TRYON_PARTS[g.category as keyof typeof TRYON_PARTS];

/** Fila deslizable de prendas para elegir una (o ninguna). */
function Picker({
  label,
  garments,
  value,
  onChange,
  disabled,
}: {
  label: string;
  garments: Garment[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-muted text-xs">{label}</legend>
      {garments.length === 0 ? (
        <p className="text-muted mt-2 text-sm">No tienes prendas de este tipo.</p>
      ) : (
        <ul className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {garments.map((g) => {
            const active = g.id === value;
            return (
              <li key={g.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(active ? null : g.id)}
                  title={g.name}
                  className={clsx(
                    "rounded-inner flex w-20 flex-col items-center gap-1 border p-1.5 text-xs transition-[border-color,transform] duration-150 active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100",
                    active ? "border-wardrobe" : "border-border hover:border-border-strong",
                  )}
                >
                  <GarmentThumb garment={g} className="h-16 w-16" />
                  <span className="w-full truncate text-center">{g.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

export function TryOnStudio({
  garments,
  personUrl,
  results,
  initialUpper,
  initialLower,
  configured,
}: {
  garments: Garment[];
  personUrl: string | null;
  results: TryOnResult[];
  initialUpper: string | null;
  initialLower: string | null;
  configured: boolean;
}) {
  const [upper, setUpper] = useState(initialUpper);
  const [lower, setLower] = useState(initialLower);
  const [photoState, setPhotoState] = useState<FormState>({ ok: true });
  const [uploading, startUpload] = useTransition();
  const [running, startRun] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cronómetro mientras se genera: la espera puede pasar del minuto
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const uppers = garments.filter((g) => partOf(g) === "upper_body");
  const lowers = garments.filter((g) => partOf(g) === "lower_body");

  function onPhoto(file: File | undefined) {
    if (!file) return;
    startUpload(async () => {
      try {
        // Lado mayor 1024 px: es lo que usa el modelo y cabe en el límite del bucket
        setPhotoState(await savePersonPhoto(await resizeImage(file, 1024, 0.88)));
      } catch {
        setPhotoState({ ok: false, message: "No se pudo leer la foto." });
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function run() {
    setError(null);
    startRun(async () => {
      const out = await tryOn({ upperId: upper, lowerId: lower });
      if (out.ok) setResult(out.url);
      else setError(out.message);
    });
  }

  const shown = result ?? null;
  const picture = shown ?? personUrl;
  const canRun = configured && !!personUrl && (!!upper || !!lower) && !running && !uploading;

  return (
    <div className="grid gap-3.5 lg:grid-cols-5">
      <Tile className="lg:col-span-2">
        <TileTitle dot="bg-wardrobe">Tu foto</TileTitle>
        <div className="bg-surface-2 rounded-inner relative mt-4 aspect-[3/4] overflow-hidden">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado y temporal
            <img
              key={picture}
              src={picture}
              alt={shown ? "Tú con las prendas elegidas" : "Tu foto de cuerpo entero"}
              className={clsx("wardrobe-pop h-full w-full object-cover", running && "opacity-60")}
            />
          ) : (
            <div className="text-muted flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              <UserRound aria-hidden="true" className="h-10 w-10" strokeWidth={1.25} />
              Sube una foto tuya de cuerpo entero, de frente, con fondo liso y buena luz.
            </div>
          )}
          {running && (
            <p
              role="status"
              className="bg-surface/90 rounded-inner absolute inset-x-3 bottom-3 px-3 py-2 text-center text-sm"
            >
              Generando… {seconds} s · suele tardar entre 15 s y 1 min
            </p>
          )}
        </div>
        {shown && !running && (
          <button type="button" onClick={() => setResult(null)} className={clsx(buttonClass.secondary, "mt-3")}>
            Ver mi foto original
          </button>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <label className={clsx(buttonClass.secondary, "cursor-pointer", uploading && "opacity-50")}>
            <ImagePlus aria-hidden="true" className="h-4 w-4" />
            {uploading ? "Subiendo…" : personUrl ? "Cambiar foto" : "Subir foto"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              disabled={uploading || running}
              onChange={(e) => onPhoto(e.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {personUrl && (
            <button
              type="button"
              disabled={uploading || running}
              onClick={() => {
                if (!confirm("¿Quitar tu foto?")) return;
                startUpload(async () => {
                  await deletePersonPhoto();
                  setResult(null);
                });
              }}
              className={buttonClass.danger}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Quitar
            </button>
          )}
        </div>
        <div className="mt-3">
          <FormMessage state={photoState} />
        </div>
        <p className="text-muted mt-3 text-xs">
          Tu foto se guarda en privado en tu armario. Solo cuando pulsas «Probar en mí» se envía, junto con las prendas,
          a un servicio gratuito de Hugging Face que genera la imagen.
        </p>
      </Tile>

      <div className="flex flex-col gap-3.5 lg:col-span-3">
        <Tile>
          <TileTitle dot="bg-wardrobe">Qué te pruebas</TileTitle>
          {garments.length === 0 ? (
            <EmptyState>
              Aún no tienes partes de arriba, abrigos ni pantalones.{" "}
              <Link href="/armario/prendas" className="text-text underline underline-offset-4">
                Añade prendas
              </Link>
              .
            </EmptyState>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <Picker
                label={`Arriba (${CATEGORY_LABELS.top.toLowerCase()} o ${CATEGORY_LABELS.outerwear.toLowerCase()})`}
                garments={uppers}
                value={upper}
                onChange={setUpper}
                disabled={running}
              />
              <Picker
                label={`Abajo (${CATEGORY_LABELS.bottom.toLowerCase()})`}
                garments={lowers}
                value={lower}
                onChange={setLower}
                disabled={running}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={!canRun} onClick={run} className={buttonClass.primary}>
                  <Camera aria-hidden="true" className="h-4 w-4" />
                  {running ? "Generando…" : "Probar en mí"}
                </button>
                <p className="text-muted text-xs">
                  {!configured
                    ? "Falta configurar el token de Hugging Face (HF_TOKEN) en Vercel."
                    : !personUrl
                      ? "Primero sube tu foto."
                      : upper && lower
                        ? "Con arriba y abajo se hacen dos pasadas: tarda el doble y gasta dos usos del cupo diario."
                        : "El servicio gratuito tiene un cupo diario de usos."}
                </p>
              </div>
              {error && (
                <p role="alert" className="bg-surface-2 rounded-inner text-attention px-3.5 py-2.5 text-sm">
                  {error}
                </p>
              )}
            </div>
          )}
        </Tile>

        <Tile>
          <TileTitle dot="bg-wardrobe">Pruebas anteriores</TileTitle>
          {results.length === 0 ? (
            <EmptyState>Aquí aparecerán las imágenes que generes.</EmptyState>
          ) : (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {results.map((r) => (
                <li key={r.path} className="group relative">
                  <button
                    type="button"
                    onClick={() => setResult(r.url)}
                    aria-label="Ver esta prueba"
                    className="bg-surface-2 rounded-inner block aspect-[3/4] w-full overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado */}
                    <img src={r.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    aria-label="Borrar esta prueba"
                    onClick={() => {
                      if (!confirm("¿Borrar esta prueba?")) return;
                      startUpload(async () => {
                        await deleteTryOn(r.path);
                        if (result === r.url) setResult(null);
                      });
                    }}
                    className="bg-surface/90 text-muted hover:text-expense absolute top-1.5 right-1.5 rounded-full p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </div>
    </div>
  );
}

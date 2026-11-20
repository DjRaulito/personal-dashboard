"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Camera, Check } from "lucide-react";
import { combineGarments, combinePhoto } from "@/app/(app)/armario/actions";
import { buttonClass, EmptyState, Tile, TileTitle } from "@/components/ui";
import { resizeImage } from "@/lib/image-resize";
import { VERDICT_LABELS, type CombineResult } from "@/lib/wardrobe/ai";
import { colorText, TONE_LABELS } from "@/lib/wardrobe/colors";
import { CATEGORIES, CATEGORY_PLURALS, type Garment } from "@/lib/wardrobe/types";
import { GarmentThumb } from "./garment-thumb";

const VERDICT_MARK = { yes: "✓", risky: "!", no: "✕" } as const;
const VERDICT_TONE = { yes: "text-finance", risky: "text-attention", no: "text-expense" } as const;

function Verdict({ result }: { result: CombineResult }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      {/* El veredicto va en palabras y con símbolo: el color solo lo refuerza */}
      <p className={clsx("text-2xl font-extrabold", VERDICT_TONE[result.verdict])}>
        {VERDICT_MARK[result.verdict]} {VERDICT_LABELS[result.verdict]}
      </p>
      <p className="text-sm">{result.summary}</p>
      {result.fix && (
        <p className="bg-surface-2 rounded-inner px-4 py-3 text-sm">
          <span className="font-semibold">Arreglo: </span>
          {result.fix}
        </p>
      )}
      {result.pieces.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {result.pieces.map((p, i) => (
            <li key={i}>
              <span className="font-semibold">{p.what}</span>
              <span className="text-muted">
                {" "}
                · {p.color}, tono {TONE_LABELS[p.tone]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** ¿Combina? Con una foto de lo que llevas o eligiendo 2–3 prendas del armario. */
export function CombineStudio({ garments, aiReady }: { garments: Garment[]; aiReady: boolean }) {
  const [mode, setMode] = useState<"pick" | "photo">(garments.length >= 2 ? "pick" : "photo");
  const [picked, setPicked] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<CombineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(garments.map((g) => [g.id, g]));

  const toggle = (id: string) => {
    setResult(null);
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= 4 ? list : [...list, id]));
  };

  function check() {
    setError(null);
    start(async () => {
      const r = await combineGarments(picked);
      if (!r.ok) return setError(r.message);
      setResult(r.data);
    });
  }

  function fromPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const image = await resizeImage(file, 1024, 0.85);
        setPhoto(`data:${image.mime};base64,${image.data}`);
        const r = await combinePhoto(image);
        if (!r.ok) return setError(r.message);
        setResult(r.data);
      } catch {
        setError("No se pudo leer la foto.");
      }
    });
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-5">
      <Tile className="lg:col-span-3">
        <div className="flex flex-wrap items-center gap-3">
          <TileTitle dot="bg-wardrobe">¿Combina?</TileTitle>
          <div role="tablist" aria-label="Cómo" className="bg-surface-2 ml-auto flex rounded-full p-1">
            {(
              [
                ["pick", "Elegir prendas"],
                ["photo", "Foto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setResult(null);
                }}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm font-semibold",
                  mode === id ? "bg-wardrobe text-ink" : "text-muted hover:text-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "photo" ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-muted text-sm">
              Hazte una foto con lo que llevas (o pon las prendas juntas) y te digo cada color por su nombre y si
              combinan. La foto se envía al servicio de IA para analizarla y no se guarda.
            </p>
            <label
              className={clsx(buttonClass.primary, "cursor-pointer self-start", (pending || !aiReady) && "opacity-50")}
            >
              <Camera aria-hidden="true" className="h-4 w-4" /> {pending ? "Mirando…" : "Hacer o elegir foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={pending || !aiReady}
                onChange={(e) => fromPhoto(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto
              <img src={photo} alt="Tu foto" className="rounded-inner max-h-80 self-start object-contain" />
            )}
          </div>
        ) : garments.length < 2 ? (
          <EmptyState>Necesitas al menos dos prendas en el armario.</EmptyState>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-muted text-sm">Elige de 2 a 4 prendas ({picked.length} elegidas).</p>
            {CATEGORIES.filter((c) => garments.some((g) => g.category === c)).map((c) => (
              <fieldset key={c}>
                <legend className="text-muted text-xs">{CATEGORY_PLURALS[c]}</legend>
                <ul className="-mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1">
                  {garments
                    .filter((g) => g.category === c)
                    .map((g) => {
                      const on = picked.includes(g.id);
                      return (
                        <li key={g.id} className="shrink-0">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(g.id)}
                            title={`${g.name}: ${g.colorDetails.map(colorText).join(" / ")}`}
                            className={clsx(
                              "rounded-inner relative flex w-24 flex-col items-center gap-1 border p-1.5 text-xs",
                              on ? "border-wardrobe border-2" : "border-border hover:border-border-strong",
                            )}
                          >
                            {on && (
                              <span className="bg-wardrobe text-ink absolute top-1 right-1 rounded-full p-0.5">
                                <Check aria-hidden="true" className="h-3 w-3" />
                              </span>
                            )}
                            <GarmentThumb garment={g} className="h-16 w-16" />
                            <span className="w-full truncate text-center">{g.name}</span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={pending || picked.length < 2 || !aiReady}
              onClick={check}
              className={clsx(buttonClass.primary, "self-start")}
            >
              {pending ? "Mirando…" : "¿Combina?"}
            </button>
          </div>
        )}
        {!aiReady && <p className="text-muted mt-3 text-xs">Falta configurar la IA (Ajustes → Conexiones).</p>}
      </Tile>

      <Tile className="lg:col-span-2">
        <TileTitle dot="bg-wardrobe">Veredicto</TileTitle>
        <div className="mt-4">
          {error ? (
            <p role="alert" className="text-attention text-sm">
              {error}
            </p>
          ) : result ? (
            <Verdict result={result} />
          ) : mode === "pick" && picked.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {picked.map((id) => {
                const g = byId.get(id);
                return g ? (
                  <li key={id}>
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-muted"> · {g.colorDetails.map(colorText).join(" / ")}</span>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="text-muted text-sm">Aquí verás cada color en palabras y si combinan.</p>
          )}
        </div>
      </Tile>
    </div>
  );
}

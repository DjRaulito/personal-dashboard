"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Camera, ChevronLeft, ChevronRight, Shuffle, Sparkles, X } from "lucide-react";
import { saveCity, saveOutfit, suggestOutfits } from "@/app/(app)/armario/actions";
import { buttonClass, EmptyState, Field, FormMessage, inputClass, Tile, TileTitle } from "@/components/ui";
import type { FormState } from "@/lib/finance/schemas";
import { weatherLine, type ResolvedOutfit, type Weather } from "@/lib/wardrobe/ai";
import {
  CATEGORY_LABELS,
  MAX_ACCESSORIES,
  OCCASION_LABELS,
  OCCASIONS,
  lookFrom,
  lookIds,
  type Category,
  type Garment,
  type Look,
  type Occasion,
} from "@/lib/wardrobe/types";
import { GarmentThumb } from "./garment-thumb";
import { Mannequin } from "./mannequin";

type MainSlot = "top" | "bottom" | "shoes";

// Dónde cae cada zona sobre el maniquí, en % del escenario (ver mannequin.tsx)
const BANDS: Record<MainSlot, { top: number; height: number; width: number; z: number; align: string }> = {
  top: { top: 15.5, height: 36, width: 44, z: 30, align: "object-top" },
  bottom: { top: 45, height: 49, width: 27, z: 20, align: "object-top" },
  shoes: { top: 88.5, height: 10, width: 25, z: 10, align: "object-bottom" },
};

const pill = (active: boolean) =>
  clsx(
    "rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
    active ? "bg-wardrobe text-ink" : "bg-surface-2 text-muted hover:text-text",
  );

const iconButton =
  "border-border-strong hover:bg-surface-2 active:bg-border focus-visible:outline-content inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-[background-color,transform] duration-150 active:scale-90 focus-visible:outline-2 disabled:opacity-40 motion-reduce:active:scale-100";

/** Distancia circular de un elemento al activo: …, -1, 0, 1, … */
function offset(index: number, active: number, count: number): number {
  let d = index - active;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
}

function GarmentImage({ garment, align }: { garment: Garment; align: string }) {
  if (!garment.url) {
    return (
      <span className="bg-surface-2 rounded-inner text-muted flex h-full w-full items-center justify-center p-2 text-center text-xs">
        {garment.name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado y temporal
    <img
      src={garment.url}
      alt=""
      draggable={false}
      className={clsx(
        "h-full w-full",
        garment.cutout
          ? `object-contain ${align} drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]`
          : "rounded-inner object-cover",
      )}
    />
  );
}

/** Carrusel con profundidad de una zona: la prenda del centro es la que lleva el maniquí. */
function Band({
  slot,
  items,
  activeId,
  onSelect,
  onStep,
}: {
  slot: MainSlot;
  items: Garment[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const band = BANDS[slot];
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const active = Math.max(
    0,
    items.findIndex((g) => g.id === activeId),
  );
  return (
    <div
      className="absolute inset-x-0 touch-pan-y select-none"
      style={{ top: `${band.top}%`, height: `${band.height}%`, zIndex: band.z, perspective: "900px" }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, moved: false };
      }}
      onPointerUp={(e) => {
        const start = drag.current;
        drag.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) < 30) return;
        // Deslizar a la izquierda trae la prenda siguiente
        onStep(dx < 0 ? 1 : -1);
        drag.current = { x: e.clientX, moved: true };
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {items.map((garment, index) => {
        const d = offset(index, active, items.length);
        if (Math.abs(d) > 2) return null;
        const side = d !== 0;
        return (
          <div
            key={garment.id}
            onClick={() => {
              // Tras arrastrar no cuenta como toque
              if (drag.current?.moved) {
                drag.current = null;
                return;
              }
              if (side) onSelect(garment.id);
            }}
            className={clsx(
              "absolute top-0 left-1/2 h-full transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,0.8,0.26,1)] motion-reduce:transition-none",
              side && "cursor-pointer",
            )}
            style={{
              width: `${band.width}%`,
              opacity: d === 0 ? 1 : Math.abs(d) === 1 ? 0.45 : 0.12,
              transform: `translateX(-50%) translateX(${d * 33}cqw) translateZ(${-Math.abs(d) * 150}px) rotateY(${d * -38}deg)`,
              zIndex: 3 - Math.abs(d),
            }}
          >
            <GarmentImage garment={garment} align={band.align} />
          </div>
        );
      })}
    </div>
  );
}

function CityForm({ city }: { city: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCity, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label="Tu ciudad (para el tiempo)" error={state.errors?.city} className="min-w-0 flex-1">
          <input
            name="city"
            defaultValue={city ?? ""}
            required
            maxLength={80}
            autoComplete="address-level2"
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          {pending ? "Buscando…" : "Guardar"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function FittingRoom({
  garments,
  initialIds,
  weather,
  city,
}: {
  garments: Garment[];
  /** Outfit guardado que se abre en el probador. */
  initialIds: string[] | null;
  weather: Weather | null;
  city: string | null;
}) {
  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const lists = useMemo(() => {
    const of = (c: Category) => garments.filter((g) => g.category === c);
    return {
      top: of("top"),
      bottom: of("bottom"),
      outerwear: of("outerwear"),
      shoes: of("shoes"),
      accessory: of("accessory"),
    };
  }, [garments]);

  const [look, setLook] = useState<Look>(() =>
    initialIds?.length
      ? lookFrom(initialIds, garments)
      : {
          top: lists.top[0]?.id ?? null,
          bottom: lists.bottom[0]?.id ?? null,
          shoes: lists.shoes[0]?.id ?? null,
          outerwear: null,
          accessories: [],
        },
  );

  // Guardar el conjunto actual
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<FormState>({ ok: true });
  const [saving, startSaving] = useTransition();

  // Estilista
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [useWeather, setUseWeather] = useState(weather !== null);
  const [pinId, setPinId] = useState("");
  const [wishes, setWishes] = useState("");
  const [editCity, setEditCity] = useState(false);
  const [ideas, setIdeas] = useState<ResolvedOutfit[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [thinking, startThinking] = useTransition();

  if (garments.length === 0) {
    return (
      <Tile>
        <EmptyState>
          Tu armario está vacío. Sube las fotos de tu ropa en{" "}
          <Link href="/armario/prendas" className="text-text underline underline-offset-4">
            Prendas
          </Link>{" "}
          y vuelve para probártela.
        </EmptyState>
      </Tile>
    );
  }

  /** Pasa a la prenda siguiente o anterior de una zona (el abrigo incluye «sin abrigo»). */
  function step(slot: MainSlot | "outerwear", dir: 1 | -1) {
    setLook((current) => {
      const ids: (string | null)[] = lists[slot].map((g) => g.id);
      if (slot === "outerwear") ids.unshift(null);
      if (ids.length === 0) return current;
      const at = Math.max(0, ids.indexOf(current[slot]));
      return { ...current, [slot]: ids[(at + dir + ids.length) % ids.length] };
    });
    setSaved({ ok: true });
  }

  function toggleAccessory(id: string) {
    setLook((current) => {
      const on = current.accessories.includes(id);
      if (!on && current.accessories.length >= MAX_ACCESSORIES) return current;
      return {
        ...current,
        accessories: on ? current.accessories.filter((a) => a !== id) : [...current.accessories, id],
      };
    });
  }

  function shuffle() {
    const random = (list: Garment[], avoid: string | null) => {
      const pool = list.length > 1 ? list.filter((g) => g.id !== avoid) : list;
      return pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
    };
    setLook((current) => ({
      ...current,
      top: random(lists.top, current.top),
      bottom: random(lists.bottom, current.bottom),
      shoes: random(lists.shoes, current.shoes),
    }));
  }

  function store(input: { name: string; occasion: Occasion | null; note: string | null; garmentIds: string[] }) {
    startSaving(async () => setSaved(await saveOutfit(input)));
  }

  function ask(e: React.FormEvent) {
    e.preventDefault();
    setAiError(null);
    startThinking(async () => {
      const result = await suggestOutfits({
        occasion,
        pinId: pinId || null,
        wishes,
        useWeather: useWeather && weather !== null,
      });
      if (result.ok) setIdeas(result.data);
      else setAiError(result.message);
    });
  }

  const worn = lookIds(look)
    .map((id) => byId.get(id))
    .filter((g): g is Garment => !!g);
  const outerwear = look.outerwear ? byId.get(look.outerwear) : undefined;
  const rows: { slot: MainSlot | "outerwear"; empty: string }[] = [
    { slot: "outerwear", empty: "Sin abrigo" },
    { slot: "top", empty: "—" },
    { slot: "bottom", empty: "—" },
    { slot: "shoes", empty: "—" },
  ];

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-5">
      {/* Escenario */}
      <Tile className="p-3 sm:p-4 lg:col-span-3">
        <div
          aria-hidden="true"
          className="bg-bg rounded-inner relative mx-auto aspect-[4/5] w-full max-w-[36rem] overflow-hidden"
          style={{ containerType: "inline-size" }}
        >
          <Mannequin className="absolute top-[2%] left-1/2 h-[96%] -translate-x-1/2" />
          {(["bottom", "shoes", "top"] as const).map((slot) => (
            <Band
              key={slot}
              slot={slot}
              items={lists[slot]}
              activeId={look[slot]}
              onSelect={(id) => setLook((current) => ({ ...current, [slot]: id }))}
              onStep={(dir) => step(slot, dir)}
            />
          ))}
          {outerwear && (
            <div
              key={outerwear.id}
              className="wardrobe-pop pointer-events-none absolute left-1/2 -translate-x-1/2"
              style={{ top: "13.5%", height: "43%", width: "52%", zIndex: 40 }}
            >
              <GarmentImage garment={outerwear} align="object-top" />
            </div>
          )}
          {look.accessories.length > 0 && (
            <div className="absolute top-3 left-3 z-50 flex flex-col gap-2">
              {look.accessories.map((id) => (
                <GarmentThumb key={id} garment={byId.get(id)} className="wardrobe-pop border-border h-14 w-14 border" />
              ))}
            </div>
          )}
        </div>
        <p className="sr-only" role="status">
          Llevas: {worn.map((g) => g.name).join(", ") || "nada"}.
        </p>
        <p className="text-muted mt-3 text-center text-xs">
          Desliza cada zona, o toca una prenda de los lados, para cambiarla.
        </p>
      </Tile>

      <div className="flex flex-col gap-3.5 lg:col-span-2">
        {/* Lo que llevas */}
        <Tile>
          <div className="flex items-center gap-3">
            <TileTitle dot="bg-wardrobe">Lo que llevas</TileTitle>
            <button type="button" onClick={shuffle} className={clsx(buttonClass.secondary, "ml-auto")}>
              <Shuffle aria-hidden="true" className="h-4 w-4" /> Mezclar
            </button>
            <Link
              href={`/armario/probar?${new URLSearchParams({
                ...((look.top ?? look.outerwear) ? { arriba: (look.top ?? look.outerwear)! } : {}),
                ...(look.bottom ? { abajo: look.bottom } : {}),
              })}`}
              className={buttonClass.secondary}
            >
              <Camera aria-hidden="true" className="h-4 w-4" /> Probar en mí
            </Link>
          </div>
          <ul className="mt-4 flex flex-col">
            {rows
              .filter(({ slot }) => lists[slot].length > 0)
              .map(({ slot, empty }) => {
                const garment = look[slot] ? byId.get(look[slot]!) : undefined;
                const label = CATEGORY_LABELS[slot];
                const alone = lists[slot].length + (slot === "outerwear" ? 1 : 0) < 2;
                return (
                  <li key={slot} className="border-border flex items-center gap-3 border-t py-2.5 first:border-t-0">
                    <GarmentThumb garment={garment} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="text-muted text-xs">{label}</p>
                      <p className="truncate text-sm font-medium">{garment?.name ?? empty}</p>
                    </div>
                    <button
                      type="button"
                      disabled={alone}
                      onClick={() => step(slot, -1)}
                      aria-label={`${label}: anterior`}
                      className={iconButton}
                    >
                      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={alone}
                      onClick={() => step(slot, 1)}
                      aria-label={`${label}: siguiente`}
                      className={iconButton}
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
          </ul>
          {lists.accessory.length > 0 && (
            <div className="border-border border-t pt-3">
              <p className="text-muted text-xs">Accesorios (máx. {MAX_ACCESSORIES})</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lists.accessory.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={look.accessories.includes(g.id)}
                    onClick={() => toggleAccessory(g.id)}
                    className={pill(look.accessories.includes(g.id))}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className="border-border mt-3 flex flex-col gap-2 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              store({ name, occasion: null, note: null, garmentIds: lookIds(look) });
            }}
          >
            <div className="flex items-end gap-2">
              <Field label="Guardar como outfit" className="min-w-0 flex-1">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  placeholder="Nombre del outfit"
                  className={inputClass}
                />
              </Field>
              <button type="submit" disabled={saving} className={buttonClass.primary}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
            <FormMessage state={saved} />
          </form>
        </Tile>

        {/* Estilista */}
        <Tile>
          <TileTitle dot="bg-wardrobe">Estilista</TileTitle>
          <form onSubmit={ask} className="mt-4 flex flex-col gap-4">
            <fieldset>
              <legend className="text-muted text-sm">Ocasión</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={occasion === o}
                    onClick={() => setOccasion(occasion === o ? null : o)}
                    className={pill(occasion === o)}
                  >
                    {OCCASION_LABELS[o]}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 text-sm">
              {weather ? (
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={useWeather}
                    onChange={(e) => setUseWeather(e.target.checked)}
                    className="accent-wardrobe mt-0.5 h-4 w-4"
                  />
                  <span>
                    Tener en cuenta el tiempo de hoy
                    <span className="text-muted block text-xs">
                      {weatherLine(weather)} · {city}
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-muted">
                  {city
                    ? `No se ha podido consultar el tiempo de ${city} ahora.`
                    : "Indica tu ciudad para que los outfits tengan en cuenta el tiempo."}
                </p>
              )}
              {city && !editCity ? (
                <button
                  type="button"
                  onClick={() => setEditCity(true)}
                  className="text-muted hover:text-text self-start text-xs underline underline-offset-4"
                >
                  Cambiar de ciudad
                </button>
              ) : null}
            </div>

            <Field label="Tiene que llevar (opcional)">
              <select value={pinId} onChange={(e) => setPinId(e.target.value)} className={inputClass}>
                <option value="">Cualquier prenda</option>
                {garments.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Algo más (opcional)">
              <input
                value={wishes}
                onChange={(e) => setWishes(e.target.value)}
                maxLength={200}
                placeholder="P. ej. cómodo, tonos oscuros…"
                className={inputClass}
              />
            </Field>
            <button type="submit" disabled={thinking} className={clsx(buttonClass.primary, "self-start")}>
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {thinking ? "Pensando…" : "Proponer outfits"}
            </button>
            {aiError && (
              <p role="alert" className="bg-surface-2 rounded-inner text-attention px-3.5 py-2.5 text-sm">
                {aiError}
              </p>
            )}
          </form>
          {(!city || editCity) && (
            <div className="border-border mt-4 border-t pt-4">
              <CityForm city={city} />
              {editCity && (
                <button
                  type="button"
                  onClick={() => setEditCity(false)}
                  className="text-muted hover:text-text mt-2 inline-flex items-center gap-1 text-xs"
                >
                  <X aria-hidden="true" className="h-3 w-3" /> Cerrar
                </button>
              )}
            </div>
          )}

          {ideas.length > 0 && (
            <ul className="mt-5 flex flex-col gap-3" aria-label="Outfits propuestos">
              {ideas.map((idea) => (
                <li key={idea.garmentIds.join()} className="bg-surface-2 rounded-inner p-4">
                  <p className="font-semibold">{idea.name}</p>
                  {idea.why && <p className="text-muted mt-1 text-sm">{idea.why}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {idea.garmentIds.map((id) => (
                      <GarmentThumb key={id} garment={byId.get(id)} className="bg-surface h-12 w-12" />
                    ))}
                  </div>
                  <p className="text-muted mt-2 text-xs">
                    {idea.garmentIds.map((id) => byId.get(id)?.name).join(" · ")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonClass.secondary}
                      onClick={() => {
                        setLook(lookFrom(idea.garmentIds, garments));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Probar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={buttonClass.secondary}
                      onClick={() =>
                        store({ name: idea.name, occasion, note: idea.why || null, garmentIds: idea.garmentIds })
                      }
                    >
                      Guardar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </div>
    </div>
  );
}

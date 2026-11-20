"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Eraser, ImagePlus, Pencil, Trash2 } from "lucide-react";
import {
  createGarment,
  deleteGarment,
  replaceGarmentImage,
  tagGarment,
  updateGarment,
} from "@/app/(app)/armario/actions";
import { buttonClass, EmptyState, Field, inputClass, Tile, TileTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  composeCutout,
  prepareGarmentPhoto,
  sourceFromImage,
  type CutoutSource,
  type CutoutStage,
  type PreparedPhoto,
} from "@/lib/wardrobe/cutout";
import {
  colorsAgree,
  colorText,
  PATTERN_LABELS,
  PATTERNS,
  TONE_LABELS,
  TONES,
  type ColorDetail,
  type Pattern,
  type Tone,
} from "@/lib/wardrobe/colors";
import { RetouchDialog } from "./retouch";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_PLURALS,
  COLOR_INFO,
  COLORS,
  OCCASION_LABELS,
  OCCASIONS,
  WARMTH_LABELS,
  type Category,
  type Garment,
  type GarmentColor,
  type Occasion,
} from "@/lib/wardrobe/types";

interface Fields {
  name: string;
  category: Category | "";
  colors: ColorDetail[];
  pattern: Pattern;
  fabric: string;
  formality: number;
  warmth: number;
  occasions: Occasion[];
  /** La IA y el color medido en la foto no coinciden. */
  needsReview: boolean;
}

const EMPTY: Fields = {
  name: "",
  category: "",
  colors: [],
  pattern: "plain",
  fabric: "",
  formality: 2,
  warmth: 2,
  occasions: [],
  needsReview: false,
};

const FORMALITY_LABELS: Record<number, string> = {
  1: "Deporte",
  2: "Informal",
  3: "Arreglado",
  4: "Elegante",
  5: "Traje",
};

const pill = (active: boolean) =>
  clsx(
    "rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
    active ? "bg-wardrobe text-ink" : "bg-surface-2 text-muted hover:text-text",
  );

const toggle = <T,>(list: T[], value: T, max = Infinity): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : list.length >= max ? list : [...list, value];

function toFormData(fields: Fields, extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("name", fields.name);
  fd.set("category", fields.category);
  fd.set("warmth", String(fields.warmth));
  fd.set("color_details", JSON.stringify(fields.colors.filter((c) => c.name.trim())));
  fd.set("pattern", fields.pattern);
  fd.set("fabric", fields.fabric);
  fd.set("formality", String(fields.formality));
  fd.set("needs_review", fields.needsReview ? "1" : "0");
  for (const o of fields.occasions) fd.append("occasions", o);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

/** Colores en palabras: nombre preciso, tono y familia. La muestra solo acompaña. */
function ColorList({
  value,
  onChange,
  disabled,
}: {
  value: Fields;
  onChange: (next: Fields) => void;
  disabled?: boolean;
}) {
  const set = (i: number, patch: Partial<ColorDetail>) =>
    onChange({ ...value, colors: value.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="text-muted text-sm">Colores (el principal primero)</legend>
      {value.needsReview && (
        <p role="alert" className="border-attention text-attention rounded-inner border px-3 py-2 text-sm">
          ! El color de la foto no coincide con el que dice la IA. Revísalo con luz natural.{" "}
          <button
            type="button"
            onClick={() => onChange({ ...value, needsReview: false })}
            className="text-text underline underline-offset-4"
          >
            Ya lo he revisado
          </button>
        </p>
      )}
      {value.colors.length === 0 && (
        <p className="text-muted text-sm">Sin colores todavía. La IA los propone al subir la foto.</p>
      )}
      <ul className="flex flex-col gap-2">
        {value.colors.map((c, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_8rem_9rem_auto]"
          >
            <span
              aria-hidden="true"
              className="border-border-strong h-6 w-6 shrink-0 rounded-full border"
              style={{ background: c.hex }}
            />
            <input
              aria-label={`Color ${i + 1}: nombre`}
              value={c.name}
              onChange={(e) => set(i, { name: e.target.value })}
              maxLength={40}
              placeholder="P. ej. azul marino oscuro"
              className={clsx(inputClass, "col-span-2 sm:col-span-1")}
            />
            <select
              aria-label={`Color ${i + 1}: tono`}
              value={c.tone}
              onChange={(e) => set(i, { tone: e.target.value as Tone })}
              className={clsx(inputClass, "col-start-2 sm:col-start-auto")}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {TONE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              aria-label={`Color ${i + 1}: familia`}
              value={c.family}
              onChange={(e) => {
                const family = e.target.value as GarmentColor;
                set(i, { family, hex: COLOR_INFO[family].hex });
              }}
              className={clsx(inputClass, "col-start-2 sm:col-start-auto")}
            >
              {COLORS.map((f) => (
                <option key={f} value={f}>
                  {COLOR_INFO[f].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Quitar color ${i + 1}`}
              onClick={() => onChange({ ...value, colors: value.colors.filter((_, j) => j !== i) })}
              className="text-muted hover:text-expense rounded-full p-2"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {value.colors.length < 4 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              colors: [...value.colors, { name: "", family: "grey", tone: "medium", hex: COLOR_INFO.grey.hex }],
            })
          }
          className="text-muted hover:text-text self-start text-sm underline underline-offset-4"
        >
          Añadir color
        </button>
      )}
    </fieldset>
  );
}

/** Campos de una prenda (nombre, categoría, colores, dibujo, abrigo y ocasiones). */
function GarmentFields({
  value,
  onChange,
  disabled,
}: {
  value: Fields;
  onChange: (next: Fields) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            required
            maxLength={80}
            disabled={disabled}
            placeholder="P. ej. Camiseta blanca lisa"
            className={inputClass}
          />
        </Field>
        <Field label="Categoría">
          <select
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value as Category | "" })}
            required
            disabled={disabled}
            className={inputClass}
          >
            <option value="">Elige…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ColorList value={value} onChange={onChange} disabled={disabled} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Dibujo">
          <select
            value={value.pattern}
            onChange={(e) => onChange({ ...value, pattern: e.target.value as Pattern })}
            disabled={disabled}
            className={inputClass}
          >
            {PATTERNS.map((p) => (
              <option key={p} value={p}>
                {PATTERN_LABELS[p][0].toUpperCase() + PATTERN_LABELS[p].slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tejido (opcional)">
          <input
            value={value.fabric}
            onChange={(e) => onChange({ ...value, fabric: e.target.value })}
            maxLength={40}
            disabled={disabled}
            placeholder="Algodón, lana…"
            className={inputClass}
          />
        </Field>
        <Field label="Formalidad">
          <select
            value={value.formality}
            onChange={(e) => onChange({ ...value, formality: Number(e.target.value) })}
            disabled={disabled}
            className={inputClass}
          >
            {[1, 2, 3, 4, 5].map((f) => (
              <option key={f} value={f}>
                {FORMALITY_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset disabled={disabled}>
        <legend className="text-muted text-sm">Abrigo</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3].map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={value.warmth === w}
              onClick={() => onChange({ ...value, warmth: w })}
              className={pill(value.warmth === w)}
            >
              {WARMTH_LABELS[w]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend className="text-muted text-sm">Ocasiones</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={value.occasions.includes(o)}
              onClick={() => onChange({ ...value, occasions: toggle(value.occasions, o) })}
              className={pill(value.occasions.includes(o))}
            >
              {OCCASION_LABELS[o]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subida: cada foto pasa a ser un borrador que se revisa antes de guardar
// ---------------------------------------------------------------------------

interface Draft {
  key: string;
  file: File;
  status: "waiting" | "processing" | "ready" | "saving" | "failed";
  note: string;
  photo: PreparedPhoto | null;
  preview: string | null;
  fields: Fields;
  /** La IA ha rellenado los campos (el usuario los revisa). */
  tagged: boolean;
}

const stageText = (s: CutoutStage) =>
  s.step === "model"
    ? `Preparando el recortador${s.progress > 0 && s.progress < 100 ? ` (${Math.round(s.progress)} %)` : ""}… la primera vez tarda`
    : s.step === "cutting"
      ? "Quitando el fondo…"
      : "Casi lista…";

function Uploader({ userId, aiReady }: { userId: string; aiReady: boolean }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [retouching, setRetouching] = useState<Draft | null>(null);
  const working = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, next: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((list) =>
      list.map((d) => (d.key === key ? { ...d, ...(typeof next === "function" ? next(d) : next) } : d)),
    );

  // Las fotos se procesan de una en una: quitar el fondo ocupa bastante memoria
  useEffect(() => {
    if (working.current) return;
    const next = drafts.find((d) => d.status === "waiting");
    if (!next) return;
    working.current = true;
    patch(next.key, { status: "processing", note: "Leyendo la foto…" });
    (async () => {
      try {
        const photo = await prepareGarmentPhoto(next.file, (s) => patch(next.key, { note: stageText(s) }));
        patch(next.key, {
          status: "ready",
          photo,
          preview: URL.createObjectURL(photo.blob),
          note: photo.cutout ? "" : "No se pudo quitar el fondo. Bórralo con «Retocar» o se guardará la foto tal cual.",
        });
        if (aiReady) {
          const tags = await tagGarment(photo.forAi);
          // Solo se rellena si aún no se ha escrito nada
          if (tags.ok)
            patch(next.key, (d) =>
              d.fields.name || d.fields.category
                ? {}
                : {
                    fields: {
                      ...tags.data,
                      fabric: tags.data.fabric ?? "",
                      // Segunda opinión: el color medido en la foto sin fondo
                      needsReview: Boolean(
                        photo.measuredHex &&
                        tags.data.colors[0] &&
                        !colorsAgree(tags.data.colors[0].hex, photo.measuredHex),
                      ),
                    },
                    tagged: true,
                  },
            );
        }
      } catch {
        patch(next.key, { status: "failed", note: "No se pudo leer esta foto." });
      } finally {
        working.current = false;
        // Fuerza otra pasada para la siguiente foto en espera
        setDrafts((list) => [...list]);
      }
    })();
  }, [drafts, aiReady]);

  function add(files: FileList | null) {
    if (!files?.length) return;
    const fresh = [...files].slice(0, 30).map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "waiting" as const,
      note: "En cola…",
      photo: null,
      preview: null,
      fields: EMPTY,
      tagged: false,
    }));
    setDrafts((list) => [...list, ...fresh]);
    if (input.current) input.current.value = "";
  }

  function discard(draft: Draft) {
    if (draft.preview) URL.revokeObjectURL(draft.preview);
    setDrafts((list) => list.filter((d) => d.key !== draft.key));
  }

  async function applyRetouch(draft: Draft, mask: Uint8ClampedArray) {
    if (!draft.photo) return;
    const composed = await composeCutout(draft.photo.source, mask);
    if (draft.preview) URL.revokeObjectURL(draft.preview);
    patch(draft.key, {
      photo: { ...draft.photo, ...composed, source: { ...draft.photo.source, mask } },
      preview: URL.createObjectURL(composed.blob),
      note: "",
    });
  }

  async function save(draft: Draft) {
    if (!draft.photo || !draft.fields.name.trim() || !draft.fields.category) return;
    patch(draft.key, { status: "saving", note: "" });
    const path = `${userId}/${crypto.randomUUID()}.${draft.photo.extension}`;
    const { error } = await createClient()
      .storage.from("wardrobe")
      .upload(path, draft.photo.blob, { contentType: draft.photo.blob.type, cacheControl: "31536000" });
    if (error) {
      patch(draft.key, { status: "ready", note: "No se pudo subir la foto. Inténtalo de nuevo." });
      return;
    }
    const result = await createGarment(
      { ok: true },
      toFormData(draft.fields, { image_path: path, cutout: draft.photo.cutout ? "1" : "0" }),
    );
    if (result.ok) discard(draft);
    else
      patch(draft.key, {
        status: "ready",
        note: result.message ?? Object.values(result.errors ?? {})[0] ?? "No se pudo guardar.",
      });
  }

  return (
    <Tile>
      <div className="flex flex-wrap items-center gap-3">
        <TileTitle dot="bg-wardrobe">Añadir prendas</TileTitle>
        <label className={clsx(buttonClass.primary, "ml-auto cursor-pointer")}>
          <ImagePlus aria-hidden="true" className="h-4 w-4" /> Subir fotos
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => add(e.target.files)}
          />
        </label>
      </div>
      <p className="text-muted mt-2 text-sm">
        Una foto por prenda, extendida sobre un fondo liso y con buena luz. El fondo se quita en tu dispositivo
        {aiReady ? " y la IA propone nombre, colores y ocasiones: revísalos antes de guardar." : "."}
      </p>
      {drafts.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {drafts.map((draft) => {
            const busy = draft.status === "waiting" || draft.status === "processing";
            return (
              <li key={draft.key} className="bg-surface-2 rounded-inner flex flex-col gap-4 p-4 sm:flex-row">
                <div className="bg-bg rounded-inner flex h-40 w-full shrink-0 items-center justify-center overflow-hidden sm:w-36">
                  {draft.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto recién preparada
                    <img
                      src={draft.preview}
                      alt=""
                      className={clsx("h-full w-full", draft.photo?.cutout ? "object-contain p-2" : "object-cover")}
                    />
                  ) : (
                    <span
                      className={clsx(
                        "bg-surface-2 h-16 w-16 rounded-full",
                        busy && "animate-pulse motion-reduce:animate-none",
                      )}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {draft.note && (
                    <p
                      role="status"
                      className={clsx(
                        "mb-3 text-sm",
                        draft.status === "failed" || draft.status === "ready" ? "text-attention" : "text-muted",
                      )}
                    >
                      {draft.note}
                    </p>
                  )}
                  {(draft.status === "ready" || draft.status === "saving") && (
                    <form
                      className="flex flex-col gap-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(draft);
                      }}
                    >
                      {draft.tagged && (
                        <p className="text-muted text-xs">Propuesto por la IA: corrige lo que no encaje.</p>
                      )}
                      <GarmentFields
                        value={draft.fields}
                        onChange={(fields) => patch(draft.key, { fields })}
                        disabled={draft.status === "saving"}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={draft.status === "saving"} className={buttonClass.primary}>
                          {draft.status === "saving" ? "Guardando…" : "Guardar prenda"}
                        </button>
                        <button
                          type="button"
                          disabled={draft.status === "saving"}
                          onClick={() => setRetouching(draft)}
                          className={buttonClass.secondary}
                        >
                          <Eraser aria-hidden="true" className="h-4 w-4" /> Retocar
                        </button>
                        <button
                          type="button"
                          disabled={draft.status === "saving"}
                          onClick={() => discard(draft)}
                          className={buttonClass.danger}
                        >
                          Descartar
                        </button>
                      </div>
                    </form>
                  )}
                  {draft.status === "failed" && (
                    <button type="button" onClick={() => discard(draft)} className={buttonClass.secondary}>
                      Quitar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {retouching?.photo && (
        <RetouchDialog
          source={retouching.photo.source}
          onDone={(mask) => applyRetouch(retouching, mask)}
          onClose={() => setRetouching(null)}
        />
      )}
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Lista de prendas
// ---------------------------------------------------------------------------

function EditDialog({ garment, userId, onClose }: { garment: Garment; userId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<Fields>({
    name: garment.name,
    category: garment.category,
    colors: garment.colorDetails,
    pattern: garment.pattern,
    fabric: garment.fabric ?? "",
    formality: garment.formality,
    warmth: garment.warmth,
    occasions: garment.occasions,
    needsReview: garment.needsReview,
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [retouch, setRetouch] = useState<CutoutSource | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  async function openRetouch() {
    if (!garment.url) return;
    setError(null);
    setLoadingPhoto(true);
    try {
      const res = await fetch(garment.url);
      if (!res.ok) throw new Error();
      setRetouch(await sourceFromImage(await res.blob(), garment.cutout));
    } catch {
      setError("No se pudo abrir la foto para retocarla.");
    } finally {
      setLoadingPhoto(false);
    }
  }

  async function saveRetouch(source: CutoutSource, mask: Uint8ClampedArray) {
    const composed = await composeCutout(source, mask);
    const path = `${userId}/${crypto.randomUUID()}.${composed.extension}`;
    const { error: uploadError } = await createClient()
      .storage.from("wardrobe")
      .upload(path, composed.blob, { contentType: composed.blob.type, cacheControl: "31536000" });
    if (uploadError) throw new Error("No se pudo subir la foto retocada.");
    const result = await replaceGarmentImage(garment.id, path);
    if (!result.ok) throw new Error(result.message ?? "No se pudo guardar la foto retocada.");
  }

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={`Editar ${garment.name}`}
      className="bg-surface text-text border-border rounded-tile m-auto w-[min(34rem,calc(100vw-2rem))] border p-6 backdrop:bg-black/60"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const result = await updateGarment({ ok: true }, toFormData(fields, { id: garment.id }));
            if (result.ok) dialog.current?.close();
            else setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "No se pudo guardar.");
          });
        }}
      >
        <h2 className="font-display text-xl font-bold">Editar prenda</h2>
        <GarmentFields value={fields} onChange={setFields} disabled={pending} />
        {error && (
          <p role="alert" className="text-attention text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={buttonClass.primary}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => dialog.current?.close()} className={buttonClass.secondary}>
            Cancelar
          </button>
          {garment.url && (
            <button
              type="button"
              disabled={pending || loadingPhoto}
              onClick={openRetouch}
              className={buttonClass.secondary}
            >
              <Eraser aria-hidden="true" className="h-4 w-4" /> {loadingPhoto ? "Abriendo…" : "Retocar recorte"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className={clsx(buttonClass.danger, "ml-auto")}
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              start(async () => {
                await deleteGarment(garment.id);
                dialog.current?.close();
              });
            }}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {confirmDelete ? "¿Seguro? Borrar" : "Borrar"}
          </button>
        </div>
      </form>
      {retouch && (
        <RetouchDialog
          source={retouch}
          onDone={async (mask) => {
            await saveRetouch(retouch, mask);
            dialog.current?.close();
          }}
          onClose={() => setRetouch(null)}
        />
      )}
    </dialog>
  );
}

const shortDay = (d: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

function GarmentCard({ garment, onEdit }: { garment: Garment; onEdit: () => void }) {
  return (
    <li className="bg-surface border-border rounded-inner group relative flex flex-col overflow-hidden border">
      <div className="bg-surface-2 relative aspect-square">
        {garment.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto privada con enlace firmado y temporal
          <img
            src={garment.url}
            alt=""
            loading="lazy"
            className={clsx("absolute inset-0 h-full w-full", garment.cutout ? "object-contain p-3" : "object-cover")}
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate text-sm font-medium">{garment.name}</p>
        <p className="text-muted line-clamp-2 text-xs">
          {garment.needsReview && <span className="text-attention">! revisar · </span>}
          {garment.colorDetails.map(colorText).join(" / ") || "sin color"} · {WARMTH_LABELS[garment.warmth]}
        </p>
        <p className="text-muted text-xs">
          {garment.lastWorn ? `Puesta el ${shortDay(garment.lastWorn)}` : "Sin estrenar aquí"}
        </p>
        {garment.occasions.length > 0 && (
          <p className="text-muted truncate text-xs">{garment.occasions.map((o) => OCCASION_LABELS[o]).join(" · ")}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${garment.name}`}
        className="bg-bg/80 text-text focus-visible:outline-content absolute top-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline-2 active:scale-90 motion-reduce:active:scale-100"
      >
        <Pencil aria-hidden="true" className="h-4 w-4" />
      </button>
    </li>
  );
}

export function GarmentManager({
  garments,
  userId,
  aiReady,
}: {
  garments: Garment[];
  userId: string;
  aiReady: boolean;
}) {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [color, setColor] = useState<GarmentColor | "all">("all");
  const [occasion, setOccasion] = useState<Occasion | "all">("all");
  const [order, setOrder] = useState<"new" | "rested" | "recent">("new");
  const shown = useMemo(() => {
    const list = garments.filter(
      (g) => (color === "all" || g.colors.includes(color)) && (occasion === "all" || g.occasions.includes(occasion)),
    );
    if (order === "new") return list;
    // Sin usar primero (o usadas hace poco primero)
    return [...list].sort((a, b) => {
      const x = a.lastWorn ?? "";
      const y = b.lastWorn ?? "";
      return order === "rested" ? x.localeCompare(y) : y.localeCompare(x);
    });
  }, [garments, color, occasion, order]);
  const presentColors = COLORS.filter((c) => garments.some((g) => g.colors.includes(c)));
  const [editing, setEditing] = useState<Garment | null>(null);
  const counts = useMemo(() => {
    const map = new Map<Category, number>();
    for (const g of garments) map.set(g.category, (map.get(g.category) ?? 0) + 1);
    return map;
  }, [garments]);
  const sections = CATEGORIES.filter(
    (c) => (filter === "all" ? counts.has(c) : c === filter) && shown.some((g) => g.category === c),
  );

  return (
    <>
      <Uploader userId={userId} aiReady={aiReady} />
      <Tile>
        <div className="flex flex-wrap items-center gap-3">
          <TileTitle dot="bg-wardrobe">Tu ropa</TileTitle>
          <p className="text-muted ml-auto text-sm tabular-nums">
            {garments.length} {garments.length === 1 ? "prenda" : "prendas"}
          </p>
        </div>
        {garments.length === 0 ? (
          <EmptyState>Aún no hay prendas. Sube la primera foto.</EmptyState>
        ) : (
          <>
            <div className="-mx-6 mt-4 overflow-x-auto px-6">
              <div className="flex w-max gap-2">
                <button
                  type="button"
                  aria-pressed={filter === "all"}
                  onClick={() => setFilter("all")}
                  className={pill(filter === "all")}
                >
                  Todas
                </button>
                {CATEGORIES.filter((c) => counts.has(c)).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={filter === c}
                    onClick={() => setFilter(c)}
                    className={pill(filter === c)}
                  >
                    {CATEGORY_PLURALS[c]} <span className="tabular-nums opacity-70">{counts.get(c)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="text-muted flex flex-col gap-1 text-xs">
                Color
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value as GarmentColor | "all")}
                  className={inputClass}
                >
                  <option value="all">Todos</option>
                  {presentColors.map((c) => (
                    <option key={c} value={c}>
                      {COLOR_INFO[c].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-muted flex flex-col gap-1 text-xs">
                Ocasión
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value as Occasion | "all")}
                  className={inputClass}
                >
                  <option value="all">Todas</option>
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {OCCASION_LABELS[o]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-muted flex flex-col gap-1 text-xs">
                Orden
                <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)} className={inputClass}>
                  <option value="new">Las más nuevas</option>
                  <option value="rested">Las que llevas más sin ponerte</option>
                  <option value="recent">Puestas hace poco</option>
                </select>
              </label>
            </div>
            {sections.map((category) => (
              <section key={category} className="mt-5">
                <h3 className="text-muted text-sm">{CATEGORY_PLURALS[category]}</h3>
                <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {shown
                    .filter((g) => g.category === category)
                    .map((g) => (
                      <GarmentCard key={g.id} garment={g} onEdit={() => setEditing(g)} />
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </Tile>
      {editing && <EditDialog key={editing.id} garment={editing} userId={userId} onClose={() => setEditing(null)} />}
    </>
  );
}

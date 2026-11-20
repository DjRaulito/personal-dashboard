"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Eraser, Paintbrush, Undo2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { CutoutSource } from "@/lib/wardrobe/cutout";

type Mode = "erase" | "restore";
const MAX_UNDO = 15;

/**
 * Retocar el recorte de una prenda con el dedo o el ratón: borrar lo que sobra (la cama, una
 * almohada…) o recuperar lo que el recortador se comió. Devuelve la máscara nueva.
 */
export function RetouchDialog({
  source,
  onDone,
  onClose,
}: {
  source: CutoutSource;
  onDone: (mask: Uint8ClampedArray) => Promise<void> | void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  // Máscara como lienzo: blanco opaco = se ve, transparente = borrado
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const composite = useRef<HTMLCanvasElement | null>(null);
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const [mode, setMode] = useState<Mode>("erase");
  const [size, setSize] = useState(4);
  const [canUndo, setCanUndo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { original } = source;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext("2d")!;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < source.mask.length; i++) {
      pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255;
      pixels.data[i * 4 + 3] = source.mask[i];
    }
    ctx.putImageData(pixels, 0, 0);
    maskCanvas.current = canvas;
    paint();
    dialog.current?.showModal();
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  /** Dibuja la foto con la máscara aplicada (y la original muy tenue, para ver lo que se puede recuperar). */
  function paint() {
    const canvas = view.current;
    const mask = maskCanvas.current;
    if (!canvas || !mask) return;
    composite.current ??= Object.assign(document.createElement("canvas"), {
      width: original.width,
      height: original.height,
    });
    const layer = composite.current.getContext("2d")!;
    layer.globalCompositeOperation = "source-over";
    layer.clearRect(0, 0, original.width, original.height);
    layer.drawImage(mask, 0, 0);
    layer.globalCompositeOperation = "source-in";
    layer.drawImage(original, 0, 0);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (source.restorable) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(original, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(composite.current, 0, 0);
  }

  const schedule = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  };

  const radius = () => (Math.max(original.width, original.height) * size) / 100;

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * original.width,
      y: ((e.clientY - rect.top) / rect.height) * original.height,
    };
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = maskCanvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = "#fff";
    ctx.lineWidth = radius() * 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(to.x, to.y, radius(), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    schedule();
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = maskCanvas.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    undo.current = [...undo.current, ctx.getImageData(0, 0, original.width, original.height)].slice(-MAX_UNDO);
    setCanUndo(true);
    const p = point(e);
    last.current = p;
    stroke(p, p);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const p = point(e);
    stroke(last.current, p);
    last.current = p;
  }

  function onUp() {
    last.current = null;
  }

  function stepBack() {
    const snapshot = undo.current.pop();
    if (snapshot) maskCanvas.current?.getContext("2d")?.putImageData(snapshot, 0, 0);
    setCanUndo(undo.current.length > 0);
    schedule();
  }

  async function finish() {
    const ctx = maskCanvas.current?.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, original.width, original.height).data;
    const mask = new Uint8ClampedArray(original.width * original.height);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3];
    setSaving(true);
    setError(null);
    try {
      await onDone(mask);
      dialog.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el retoque.");
      setSaving(false);
    }
  }

  const tool = (active: boolean) =>
    clsx(
      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100",
      active ? "bg-selected text-on-selected" : "bg-surface-2 text-muted hover:text-text",
    );

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label="Retocar recorte"
      className="bg-surface-solid text-text border-border rounded-tile m-auto w-[min(40rem,calc(100vw-1rem))] border p-4 backdrop:bg-black/70 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold">Retocar recorte</h2>
      <p className="text-muted mt-1 text-sm">
        Pasa el dedo por lo que sobra para borrarlo.
        {source.restorable && " Con «Recuperar» vuelves a pintar partes de la prenda que se hayan borrado."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={mode === "erase"}
          onClick={() => setMode("erase")}
          className={tool(mode === "erase")}
        >
          <Eraser aria-hidden="true" className="h-4 w-4" /> Borrar
        </button>
        {source.restorable && (
          <button
            type="button"
            aria-pressed={mode === "restore"}
            onClick={() => setMode("restore")}
            className={tool(mode === "restore")}
          >
            <Paintbrush aria-hidden="true" className="h-4 w-4" /> Recuperar
          </button>
        )}
        <button
          type="button"
          disabled={!canUndo}
          onClick={stepBack}
          className={clsx(tool(false), "disabled:opacity-40")}
        >
          <Undo2 aria-hidden="true" className="h-4 w-4" /> Deshacer
        </button>
        <label className="text-muted ml-auto flex items-center gap-2 text-sm">
          Pincel
          <input
            type="range"
            min={1}
            max={12}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="accent-wardrobe w-24"
          />
        </label>
      </div>

      <div className="rounded-inner mt-3 flex max-h-[60dvh] justify-center overflow-hidden bg-[repeating-conic-gradient(#2a2a30_0_25%,#1e1e23_0_50%)] bg-[length:20px_20px]">
        <canvas
          ref={view}
          width={original.width}
          height={original.height}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Foto de la prenda: pasa el dedo para borrar o recuperar"
          className="max-h-[60dvh] max-w-full cursor-crosshair touch-none"
          style={{ aspectRatio: `${original.width} / ${original.height}` }}
        />
      </div>

      {error && (
        <p role="alert" className="text-attention mt-3 text-sm">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={finish} className={buttonClass.primary}>
          {saving ? "Guardando…" : "Listo"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => dialog.current?.close()}
          className={buttonClass.secondary}
        >
          Cancelar
        </button>
      </div>
    </dialog>
  );
}

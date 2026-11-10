"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { ImageInput } from "@/lib/ai/image";
import { resizeImage } from "@/lib/image-resize";

/** Botón que abre la cámara (o la galería) y entrega la foto ya reducida. */
export function PhotoButton({
  label,
  busyLabel = "Leyendo la foto…",
  busy,
  disabled,
  onImage,
  onError,
}: {
  label: string;
  busyLabel?: string;
  busy: boolean;
  disabled?: boolean;
  onImage: (image: ImageInput) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const working = busy || preparing;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPreparing(true);
          try {
            onImage(await resizeImage(file));
          } catch {
            onError("No se pudo leer la foto. Prueba con otra.");
          } finally {
            setPreparing(false);
          }
        }}
      />
      <button
        type="button"
        disabled={working || disabled}
        onClick={() => inputRef.current?.click()}
        className={buttonClass.secondary}
      >
        <Camera aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        {working ? busyLabel : label}
      </button>
    </>
  );
}

"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Laptop } from "lucide-react";

/**
 * Foto de una tienda (enlace directo, sin copiarla ni optimizarla: coste 0). Si la tienda no la
 * deja cargar, queda un dibujo en su lugar.
 */
export function RemoteImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={clsx("flex items-center justify-center overflow-hidden bg-white", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen externa de la tienda, sin optimizar
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-3"
        />
      ) : (
        <Laptop aria-hidden="true" className="h-12 w-12 text-neutral-300" />
      )}
    </div>
  );
}

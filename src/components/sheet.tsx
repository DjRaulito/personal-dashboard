"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";

/**
 * Ventana modal. `side`: panel lateral a la derecha en escritorio y hoja que sube desde abajo
 * en el móvil; si no, diálogo centrado.
 */
export function Sheet({
  title,
  onClose,
  side = false,
  children,
}: {
  title: string;
  onClose: () => void;
  side?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      // Tocar fuera cierra
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className={clsx(
        "bg-surface-solid text-text border-border max-h-none max-w-none border p-0 backdrop:bg-black/50",
        side
          ? "rounded-t-tile md:rounded-l-tile mt-auto mb-0 w-full md:mt-0 md:mr-0 md:ml-auto md:h-dvh md:w-[32rem] md:rounded-none"
          : "rounded-tile m-auto w-[min(32rem,calc(100vw-1.5rem))]",
      )}
    >
      <div
        className={clsx(
          "flex flex-col overflow-y-auto",
          side ? "max-h-[88dvh] md:h-dvh md:max-h-dvh" : "max-h-[90dvh]",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 pt-5 pb-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar"
            className="hover:bg-surface-2 focus-visible:outline-content rounded-full p-2 focus-visible:outline-2"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </dialog>
  );
}

/** Cierra el Sheet que contiene al elemento (dispara su onClose). */
export function closeSheet(el: Element | null) {
  el?.closest("dialog")?.close();
}

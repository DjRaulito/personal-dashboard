import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ajustes" };

// En móvil la portada es la lista de secciones (la pinta el layout); en escritorio la lista
// queda a la izquierda y aquí solo hace falta una pista.
export default function SettingsIndex() {
  return <p className="text-muted hidden py-6 text-sm md:block">Elige una sección de la izquierda.</p>;
}

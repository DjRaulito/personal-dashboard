// Secciones de Ajustes: solo configuración de la app, nunca se crea contenido aquí.

export interface SettingsSection {
  slug: string;
  title: string;
  description: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { slug: "cuenta", title: "Cuenta", description: "Nombre, moneda, zona horaria y cerrar sesión" },
  { slug: "conexiones", title: "Conexiones", description: "Google, tokens del Cerebro e IA" },
  { slug: "finanzas", title: "Finanzas", description: "Cuentas, categorías, extractos y salario" },
  { slug: "nutricion", title: "Nutrición", description: "Hoja de control de tu nutricionista" },
  { slug: "armario", title: "Armario", description: "Ciudad para el tiempo" },
  { slug: "datos", title: "Datos", description: "Exportar todo y borrar datos de un módulo" },
] as const;

/** Sección activa a partir de la ruta (`/ajustes/finanzas/cuentas` → finanzas); null en la portada. */
export function activeSection(pathname: string): string | null {
  const slug = pathname.split("/")[2];
  return SETTINGS_SECTIONS.some((s) => s.slug === slug) ? slug : null;
}

export type NavIcon = "home" | "finance" | "calendar" | "content" | "gym" | "nutrition" | "ai" | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Oculto en la barra inferior del móvil (solo caben 7). */
  desktopOnly?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/finanzas", label: "Finanzas", icon: "finance" },
  { href: "/calendario", label: "Calendario", icon: "calendar" },
  { href: "/contenido", label: "Contenido", icon: "content", desktopOnly: true },
  { href: "/gimnasio", label: "Gimnasio", icon: "gym" },
  { href: "/nutricion", label: "Nutrición", icon: "nutrition" },
  { href: "/ia", label: "IA", icon: "ai" },
  { href: "/ajustes", label: "Ajustes", icon: "settings" },
] as const;

/** ¿El enlace corresponde a la ruta actual? "/" solo coincide consigo misma. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

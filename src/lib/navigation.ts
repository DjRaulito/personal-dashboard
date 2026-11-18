export type NavIcon = "home" | "finance" | "nutrition" | "wardrobe" | "brain" | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Oculto en la barra inferior del móvil. */
  desktopOnly?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Hoy", icon: "home" },
  { href: "/finanzas", label: "Finanzas", icon: "finance" },
  { href: "/nutricion", label: "Nutrición", icon: "nutrition" },
  { href: "/armario", label: "Armario", icon: "wardrobe" },
  { href: "/cerebro", label: "Cerebro", icon: "brain" },
  { href: "/ajustes", label: "Ajustes", icon: "settings" },
] as const;

/** ¿El enlace corresponde a la ruta actual? "/" solo coincide consigo misma. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

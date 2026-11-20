export type NavIcon = "home" | "finance" | "investments" | "nutrition" | "wardrobe" | "brain" | "tasks" | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** En el móvil va dentro de «Más» en lugar de en la barra inferior. */
  more?: boolean;
}

// Barra superior en escritorio (Ajustes va aparte, como icono a la derecha)
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Hoy", icon: "home" },
  { href: "/finanzas", label: "Finanzas", icon: "finance" },
  { href: "/inversiones", label: "Inversiones", icon: "investments" },
  { href: "/nutricion", label: "Nutrición", icon: "nutrition" },
  { href: "/armario", label: "Armario", icon: "wardrobe", more: true },
  { href: "/tareas", label: "Tareas", icon: "tasks", more: true },
  { href: "/cerebro", label: "Cerebro", icon: "brain", more: true },
] as const;

export const SETTINGS_ITEM: NavItem = { href: "/ajustes", label: "Ajustes", icon: "settings", more: true };

/** ¿El enlace corresponde a la ruta actual? "/" solo coincide consigo misma. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

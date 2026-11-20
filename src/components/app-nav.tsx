"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  Brain,
  House,
  ListChecks,
  MoreHorizontal,
  Settings,
  Shirt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { isActive, NAV_ITEMS, type NavIcon, type NavItem } from "@/lib/navigation";
import { LinkPending } from "./link-pending";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  finance: Wallet,
  nutrition: Apple,
  wardrobe: Shirt,
  brain: Brain,
  tasks: ListChecks,
  settings: Settings,
};

const itemClass = (active: boolean) =>
  clsx(
    "focus-visible:outline-text relative flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-95 motion-reduce:active:scale-100 md:flex-row md:gap-3 md:rounded-full md:px-4 md:py-2.5 md:text-sm",
    active ? "text-text md:bg-surface-2" : "text-muted hover:text-text",
  );

function NavLink({ item, pathname, className }: { item: NavItem; pathname: string; className?: string }) {
  const Icon = ICONS[item.icon];
  const active = isActive(item.href, pathname);
  return (
    <li className={className}>
      <Link href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
        <Icon aria-hidden="true" className={clsx("h-5 w-5", active && "text-finance")} strokeWidth={1.75} />
        {/* En móvil solo cabe el nombre de la sección activa */}
        <span className={clsx(active ? "whitespace-nowrap" : "sr-only md:not-sr-only", "md:max-w-full md:truncate")}>
          {item.label}
        </span>
        <LinkPending className="absolute top-1.5 right-1/4 md:static md:ml-auto" />
      </Link>
    </li>
  );
}

/** «Más» en el móvil: Cerebro, Tareas y Ajustes en un menú que sube desde la barra. */
function MoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const active = items.some((i) => isActive(i.href, pathname));
  // Se cierra al cambiar de página
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <li className="md:hidden">
      <details ref={ref} className="relative">
        <summary className={clsx(itemClass(active), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
          <MoreHorizontal aria-hidden="true" className={clsx("h-5 w-5", active && "text-finance")} strokeWidth={1.75} />
          <span className={active ? "whitespace-nowrap" : "sr-only"}>Más</span>
        </summary>
        <ul className="bg-surface-2 border-border-strong rounded-inner absolute right-1 bottom-full mb-2 w-48 overflow-hidden border py-1 shadow-xl">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const on = isActive(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 text-sm",
                    on ? "text-text font-semibold" : "text-muted",
                  )}
                >
                  <Icon aria-hidden="true" className={clsx("h-5 w-5", on && "text-finance")} strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

/** Menú lateral en escritorio y barra inferior en móvil (4 secciones + «Más»). */
export function AppNav() {
  const pathname = usePathname();
  const more = NAV_ITEMS.filter((i) => i.more);

  return (
    <nav
      aria-label="Principal"
      className="border-border bg-bg/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:h-dvh md:w-56 md:shrink-0 md:border-t-0 md:border-r md:pb-0 md:backdrop-blur-none"
    >
      <Link href="/" className="font-display hidden px-6 pt-7 pb-8 text-xl font-extrabold md:block">
        Personal<span className="text-finance">·</span>Dashboard
      </Link>
      <ul className="grid grid-cols-5 md:flex md:flex-col md:gap-1 md:px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} className={clsx(item.more && "hidden md:block")} />
        ))}
        <MoreMenu items={more} pathname={pathname} />
      </ul>
    </nav>
  );
}

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
    "focus-visible:outline-text relative my-1.5 flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-95 motion-reduce:active:scale-100 md:my-0 md:flex-row md:gap-3 md:rounded-2xl md:px-4 md:py-2.5 md:text-sm",
    active ? "text-text bg-white/15" : "text-muted hover:text-text hover:bg-white/8",
  );

function NavLink({ item, pathname, className }: { item: NavItem; pathname: string; className?: string }) {
  const Icon = ICONS[item.icon];
  const active = isActive(item.href, pathname);
  return (
    <li className={className}>
      <Link href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
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
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
          <span className={active ? "whitespace-nowrap" : "sr-only"}>Más</span>
        </summary>
        <ul className="bg-surface-solid border-border-strong rounded-inner absolute right-0 bottom-full mb-3 w-52 overflow-hidden border py-1 shadow-xl">
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
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:h-dvh md:w-60 md:shrink-0 md:p-3.5"
    >
      {/* Cristal flotante: cápsula abajo en el móvil, panel lateral en el escritorio */}
      <div className="glass rounded-full px-1 md:flex md:h-full md:flex-col md:rounded-[var(--radius-tile)] md:px-0 md:pb-3">
        <Link href="/" className="hidden px-6 pt-6 pb-7 text-lg font-bold tracking-tight md:block">
          Personal<span className="text-finance">·</span>Dashboard
        </Link>
        <ul className="grid grid-cols-5 md:flex md:flex-1 md:flex-col md:gap-1 md:px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              className={clsx(item.more && "hidden md:block", item.href === "/ajustes" && "md:mt-auto")}
            />
          ))}
          <MoreMenu items={more} pathname={pathname} />
        </ul>
      </div>
    </nav>
  );
}

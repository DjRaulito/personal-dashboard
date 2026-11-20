"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  Brain,
  ChartLine,
  House,
  ListChecks,
  MoreHorizontal,
  Settings,
  Shirt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { isActive, NAV_ITEMS, SETTINGS_ITEM, type NavIcon, type NavItem } from "@/lib/navigation";
import { LinkPending } from "./link-pending";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  finance: Wallet,
  investments: ChartLine,
  nutrition: Apple,
  wardrobe: Shirt,
  brain: Brain,
  tasks: ListChecks,
  settings: Settings,
};

/** Barra superior flotante en escritorio: marca, secciones en el centro y Ajustes a la derecha. */
function TopBar({ pathname }: { pathname: string }) {
  const settingsOn = isActive(SETTINGS_ITEM.href, pathname);
  return (
    <div className="glass mx-auto flex max-w-6xl items-center gap-4 rounded-full py-2 pr-2 pl-6">
      <Link href="/" className="text-lg font-bold tracking-tight whitespace-nowrap">
        Personal<span className="text-finance">·</span>Dashboard
      </Link>
      <ul className="mx-auto flex min-w-0 [scrollbar-width:none] gap-0.5 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const on = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={clsx(
                  "focus-visible:outline-text relative block rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-95 motion-reduce:active:scale-100",
                  on ? "bg-selected text-on-selected font-semibold" : "text-muted hover:text-text hover:bg-white/8",
                )}
              >
                {item.label}
                {!on && <LinkPending className="absolute top-1 right-1.5" />}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={SETTINGS_ITEM.href}
        aria-label="Ajustes"
        aria-current={settingsOn ? "page" : undefined}
        className={clsx(
          "focus-visible:outline-text grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 focus-visible:outline-2",
          settingsOn ? "bg-selected text-on-selected" : "text-muted hover:text-text bg-white/8 hover:bg-white/15",
        )}
      >
        <Settings aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

const tabClass = (active: boolean) =>
  clsx(
    "focus-visible:outline-text relative my-1.5 flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-95 motion-reduce:active:scale-100",
    active ? "text-text bg-white/15" : "text-muted",
  );

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = ICONS[item.icon];
  const active = isActive(item.href, pathname);
  return (
    <li>
      <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        {/* Solo cabe el nombre de la sección activa */}
        <span className={active ? "max-w-full truncate" : "sr-only"}>{item.label}</span>
        <LinkPending className="absolute top-1.5 right-1/4" />
      </Link>
    </li>
  );
}

/** «Más» en el móvil: Armario, Tareas, Cerebro y Ajustes en un menú que sube desde la barra. */
function MoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const active = items.some((i) => isActive(i.href, pathname));
  // Se cierra al cambiar de página
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <li>
      <details ref={ref} className="relative">
        <summary className={clsx(tabClass(active), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
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

/** Barra superior en escritorio y barra inferior en móvil (4 secciones + «Más»). */
export function AppNav() {
  const pathname = usePathname();
  const more = [...NAV_ITEMS.filter((i) => i.more), SETTINGS_ITEM];

  return (
    <nav aria-label="Principal">
      <div className="sticky top-0 z-20 hidden px-4 pt-4 sm:px-7 md:block">
        <TopBar pathname={pathname} />
      </div>
      <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 md:hidden">
        <ul className="glass grid grid-cols-5 rounded-full px-1">
          {NAV_ITEMS.filter((i) => !i.more).map((item) => (
            <TabLink key={item.href} item={item} pathname={pathname} />
          ))}
          <MoreMenu items={more} pathname={pathname} />
        </ul>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, CalendarDays, Clapperboard, Dumbbell, House, Settings, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { isActive, NAV_ITEMS, type NavIcon } from "@/lib/navigation";
import { LinkPending } from "./link-pending";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  finance: Wallet,
  calendar: CalendarDays,
  content: Clapperboard,
  gym: Dumbbell,
  nutrition: Apple,
  ai: Sparkles,
  settings: Settings,
};

/** Menú lateral en escritorio y barra inferior en móvil. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="border-border bg-bg/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:h-dvh md:w-56 md:shrink-0 md:border-t-0 md:border-r md:pb-0 md:backdrop-blur-none"
    >
      <Link href="/" className="font-display hidden px-6 pt-7 pb-8 text-xl font-extrabold tracking-tight md:block">
        Personal<span className="text-finance">·</span>Dashboard
      </Link>
      <ul className="grid grid-cols-7 md:flex md:flex-col md:gap-1 md:px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href} className={clsx(item.desktopOnly && "hidden md:block")}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "focus-visible:outline-text relative flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors transition-transform duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-95 motion-reduce:active:scale-100 md:flex-row md:gap-3 md:rounded-full md:px-4 md:py-2.5 md:text-sm",
                  active ? "text-text md:bg-surface-2" : "text-muted hover:text-text",
                )}
              >
                <Icon aria-hidden="true" className={clsx("h-5 w-5", active && "text-finance")} strokeWidth={1.75} />
                <span className="max-w-full truncate">{item.label}</span>
                <LinkPending className="absolute top-1.5 right-1/4 md:static md:ml-auto" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

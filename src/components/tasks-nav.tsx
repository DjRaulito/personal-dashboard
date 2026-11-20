"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LinkPending } from "@/components/link-pending";

/** Submenú de Tareas: la portada y una píldora por tarea (se añaden solas al registrarse). */
export function TasksNav({ tasks }: { tasks: { slug: string; name: string; newItems: number }[] }) {
  const pathname = usePathname();
  const tabs = [{ href: "/tareas", label: "Todas", count: 0, active: pathname === "/tareas" }].concat(
    tasks.map((t) => ({
      href: `/tareas/${t.slug}`,
      label: t.name,
      count: t.newItems,
      active: pathname.startsWith(`/tareas/${t.slug}`),
    })),
  );
  return (
    <nav aria-label="Tareas" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="bg-surface border-border flex w-max gap-1 rounded-full border p-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={clsx(
                "relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                t.active ? "bg-content text-ink" : "text-muted hover:text-text",
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className="bg-attention text-ink rounded-full px-1.5 text-xs font-bold tabular-nums">
                  {t.count}
                  <span className="sr-only"> nuevos</span>
                </span>
              )}
              {!t.active && <LinkPending className="absolute top-1 right-2" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

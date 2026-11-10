import { clsx } from "clsx";
import { RUN_STATUS, type RunStatus } from "@/lib/agents/catalog";
import { APP_LOCALE, APP_TIMEZONE } from "@/lib/datetime";

const TONE: Record<RunStatus, string> = {
  queued: "text-muted",
  working: "text-content",
  waiting_approval: "text-attention",
  done: "text-finance",
  failed: "text-expense",
  cancelled: "text-muted",
};

const DOT: Record<RunStatus, string> = {
  queued: "bg-muted",
  working: "bg-content motion-safe:animate-pulse",
  waiting_approval: "bg-attention",
  done: "bg-finance",
  failed: "bg-expense",
  cancelled: "bg-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status in RUN_STATUS ? status : "queued") as RunStatus;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", TONE[s])}>
      <span aria-hidden="true" className={clsx("h-2 w-2 rounded-full", DOT[s])} />
      {RUN_STATUS[s]}
    </span>
  );
}

/** Fecha y hora cortas en Madrid (p. ej. «10 nov, 18:42»). */
export function shortDateTime(iso: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(iso));
}

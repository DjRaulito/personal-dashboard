import { wallClockDate } from "@/lib/datetime";

const iso = (y: number, m: number) => {
  const date = new Date(Date.UTC(y, m - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

/** Mes actual (Madrid) y ventana de los últimos `months` meses, como fechas YYYY-MM-DD. */
export function financePeriods(now: Date, months = 12) {
  const { year, month } = wallClockDate(now);
  return {
    monthStart: iso(year, month),
    nextMonthStart: iso(year, month + 1),
    windowStart: iso(year, month - (months - 1)),
    monthKey: iso(year, month).slice(0, 7),
  };
}

/** Lista de los primeros de mes entre dos fechas (fin exclusivo). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  while (iso(y, m) < to) {
    out.push(iso(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

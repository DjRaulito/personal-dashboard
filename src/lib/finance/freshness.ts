// «Actualizado hace X» y aviso de datos viejos (más de 3 días sin datos nuevos).

export const STALE_DAYS = 3;

export interface Freshness {
  label: string;
  stale: boolean;
}

/** `date`: YYYY-MM-DD; `today`: YYYY-MM-DD en Europe/Madrid. */
export function freshness(date: string | null, today: string): Freshness {
  if (!date) return { label: "sin datos", stale: true };
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  const label = days <= 0 ? "al día (hoy)" : days === 1 ? "de ayer" : `de hace ${days} días`;
  return { label, stale: days > STALE_DAYS };
}

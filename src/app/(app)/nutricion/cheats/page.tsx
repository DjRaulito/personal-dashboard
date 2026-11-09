import type { Metadata } from "next";
import { CheatForm, DeleteButton } from "@/components/nutrition/forms";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { getCheats, getReviews } from "@/lib/nutrition/server";

export const metadata: Metadata = { title: "Cheat meals · Nutrición" };

const date = (d: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export default async function CheatsPage() {
  const [cheats, reviews] = await Promise.all([getCheats(), getReviews()]);
  const today = dayKey(new Date());
  // Agrupar por periodo entre revisiones (la más reciente primero)
  const bounds = reviews.map((r) => r.review_on);
  const periodOf = (d: string) => bounds.find((b) => d > b) ?? null;
  const periods = new Map<string | null, typeof cheats>();
  for (const c of cheats) {
    const key = periodOf(c.eaten_on);
    periods.set(key, [...(periods.get(key) ?? []), c]);
  }
  const lastReview = bounds[0] ?? null;
  const current = periods.get(lastReview) ?? [];
  const currentKcal = current.reduce((s, c) => s + (c.kcal ?? 0), 0);

  return (
    <>
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3.5">
        <Tile>
          <p className="text-muted text-sm">{lastReview ? `Desde la revisión del ${date(lastReview)}` : "En total"}</p>
          <p className="font-display mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{current.length}</p>
          <p className="text-muted mt-1 text-xs">cheat meals</p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Kcal estimadas</p>
          <p className="font-display mt-2 text-3xl font-extrabold tracking-tight tabular-nums">
            {currentKcal ? currentKcal.toLocaleString(APP_LOCALE) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs">en ese periodo</p>
        </Tile>
      </section>
      <Tile>
        <TileTitle dot="bg-gym">Apuntar cheat meal</TileTitle>
        <div className="mt-4">
          <CheatForm today={today} />
        </div>
      </Tile>
      {cheats.length === 0 ? (
        <Tile>
          <EmptyState>Aún no has apuntado ningún cheat meal.</EmptyState>
        </Tile>
      ) : (
        [...periods].map(([since, list]) => (
          <Tile key={since ?? "inicio"}>
            <TileTitle dot="bg-gym">
              {since ? `Tras la revisión del ${date(since)}` : "Antes de la primera revisión"} · {list.length}
            </TileTitle>
            <ul className="mt-3 flex flex-col">
              {list.map((c) => (
                <li
                  key={c.id}
                  className="border-border flex flex-wrap items-start gap-x-4 gap-y-2 border-t py-3 first:border-0"
                >
                  <span className="text-muted w-24 shrink-0 text-sm">{date(c.eaten_on)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{c.description}</p>
                    <p className="text-muted mt-0.5 text-xs tabular-nums">
                      {c.kcal !== null ? `${c.kcal.toLocaleString(APP_LOCALE)} kcal` : "Sin estimar"}
                      {c.protein_g !== null && ` · P ${c.protein_g} · HC ${c.carbs_g ?? "—"} · G ${c.fat_g ?? "—"}`}
                      {c.estimated_by === "ai" && " · estimado con IA"}
                    </p>
                    {c.ai_notes && <p className="text-muted mt-0.5 text-xs">{c.ai_notes}</p>}
                  </div>
                  <DeleteButton kind="cheat" id={c.id} label={`el cheat meal del ${date(c.eaten_on)}`} />
                </li>
              ))}
            </ul>
          </Tile>
        ))
      )}
    </>
  );
}

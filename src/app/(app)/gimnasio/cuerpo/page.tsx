import type { Metadata } from "next";
import { TrendChart } from "@/components/gym/charts";
import { DeleteMeasurement, MeasurementForm } from "@/components/gym/forms";
import { EmptyState, Tile, TileTitle } from "@/components/ui";
import { APP_LOCALE, dayKey } from "@/lib/datetime";
import { getMeasurements } from "@/lib/gym/server";

export const metadata: Metadata = { title: "Cuerpo · Gimnasio" };

const num = (v: number | null, unit: string) =>
  v === null ? "—" : `${v.toLocaleString(APP_LOCALE, { maximumFractionDigits: 1 })} ${unit}`;
const date = (d: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export default async function BodyPage() {
  const measurements = await getMeasurements();
  const today = dayKey(new Date());
  const weights = measurements
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ date: m.measured_on, value: m.weight_kg! }))
    .reverse();
  const latest = weights[weights.length - 1];
  const monthAgo = weights
    .filter((w) => w.date <= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    .pop();
  const change = latest && monthAgo ? latest.value - monthAgo.value : null;
  const lastFat = measurements.find((m) => m.body_fat_pct !== null);
  const lastWaist = measurements.find((m) => m.waist_cm !== null);

  return (
    <>
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile>
          <p className="text-muted text-sm">Peso</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {latest ? num(latest.value, "kg") : "—"}
          </p>
          {latest && <p className="text-muted mt-1 text-xs">{date(latest.date)}</p>}
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Último mes</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {change === null ? "—" : `${change > 0 ? "+" : ""}${num(change, "kg")}`}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Grasa corporal</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {num(lastFat?.body_fat_pct ?? null, "%")}
          </p>
        </Tile>
        <Tile>
          <p className="text-muted text-sm">Cintura</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {num(lastWaist?.waist_cm ?? null, "cm")}
          </p>
        </Tile>
      </section>

      <Tile>
        <TileTitle dot="bg-gym">Peso</TileTitle>
        <div className="mt-4">
          {weights.length >= 2 ? (
            <TrendChart points={weights} unit="kg" label="Peso" />
          ) : (
            <EmptyState>Apunta tu peso al menos dos días para ver la evolución.</EmptyState>
          )}
        </div>
      </Tile>

      <Tile>
        <TileTitle dot="bg-gym">Nueva medida</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Rellena solo lo que hayas medido. Si ya hay una medida ese día, se actualiza.
        </p>
        <div className="mt-4">
          <MeasurementForm today={today} />
        </div>
      </Tile>

      {measurements.length > 0 && (
        <Tile className="p-0 sm:p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  {["Fecha", "Peso", "Grasa", "Cintura", "Pecho", "Brazo", "Muslo", ""].map((h, i) => (
                    <th key={i} scope="col" className="px-4 py-3 font-normal first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measurements.slice(0, 60).map((m) => (
                  <tr key={m.id} className="border-border border-b last:border-0">
                    <td className="px-4 py-2 pl-5">{date(m.measured_on)}</td>
                    <td className="px-4 py-2">{num(m.weight_kg, "kg")}</td>
                    <td className="px-4 py-2">{num(m.body_fat_pct, "%")}</td>
                    <td className="px-4 py-2">{num(m.waist_cm, "cm")}</td>
                    <td className="px-4 py-2">{num(m.chest_cm, "cm")}</td>
                    <td className="px-4 py-2">{num(m.arm_cm, "cm")}</td>
                    <td className="px-4 py-2">{num(m.thigh_cm, "cm")}</td>
                    <td className="px-4 py-1 text-right">
                      <DeleteMeasurement id={m.id} label={date(m.measured_on)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tile>
      )}
    </>
  );
}

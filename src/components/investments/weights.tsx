import { formatCents } from "@/lib/finance/money";

const pctLabel = (w: number) => `${(w * 100).toLocaleString("es-ES", { maximumFractionDigits: w < 0.1 ? 1 : 0 })} %`;

/** Peso de todas las posiciones abiertas (sin agrupar en «Otras»), en barras relativas a la mayor. */
export function WeightsList({ rows }: { rows: { assetId: string; name: string; weight: number; valueEur: number }[] }) {
  const max = Math.max(...rows.map((r) => r.weight), 0);
  if (max <= 0) return null;
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.assetId} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1.5 text-sm">
          <a href={`/inversiones/posiciones?activo=${r.assetId}`} className="truncate hover:underline">
            {r.name}
          </a>
          <span className="tabular-nums" title={formatCents(Math.round(r.valueEur * 100))}>
            {pctLabel(r.weight)}
          </span>
          <span aria-hidden="true" className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <span className="bg-finance block h-full rounded-full" style={{ width: `${(r.weight / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

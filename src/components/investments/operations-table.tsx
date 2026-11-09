import { formatCents } from "@/lib/finance/money";
import { DeleteOperationButton } from "./delete-operation";

const TYPE_LABELS = { buy: "Compra", sell: "Venta", dividend: "Dividendo", fee: "Comisión" } as const;
const SOURCE_LABELS: Record<string, string> = {
  investing: "Investing",
  myinvestor: "MyInvestor",
  mexem: "MEXEM",
  manual: "Manual",
};
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export interface OperationRow {
  id: string;
  date: string;
  assetName?: string;
  type: keyof typeof TYPE_LABELS;
  quantity: number;
  price: number | null;
  currency: string;
  cashEur: number | null;
  isSplit: boolean;
  source: string;
}

export function OperationsTable({ rows, showAsset = true }: { rows: OperationRow[]; showAsset?: boolean }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-muted text-left">
          <tr>
            <th className="py-2 font-medium">Fecha</th>
            {showAsset && <th className="py-2 font-medium">Activo</th>}
            <th className="py-2 font-medium">Tipo</th>
            <th className="py-2 text-right font-medium">Cantidad</th>
            <th className="py-2 text-right font-medium">Precio</th>
            <th className="py-2 text-right font-medium">Importe</th>
            <th className="py-2">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-border border-t">
              <td className="text-muted py-2 whitespace-nowrap tabular-nums">
                {dateFmt.format(new Date(`${o.date}T00:00:00Z`))}
              </td>
              {showAsset && <td className="max-w-56 truncate py-2">{o.assetName}</td>}
              <td className="py-2">
                {o.isSplit ? "Ajuste de títulos" : TYPE_LABELS[o.type]}
                <span className="text-muted block text-xs">{SOURCE_LABELS[o.source] ?? o.source}</span>
              </td>
              <td className="py-2 text-right tabular-nums">
                {o.quantity ? o.quantity.toLocaleString("es-ES", { maximumFractionDigits: 6 }) : "—"}
              </td>
              <td className="text-muted py-2 text-right tabular-nums">
                {o.price ? `${o.price.toLocaleString("es-ES", { maximumFractionDigits: 4 })} ${o.currency}` : "—"}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {o.cashEur == null ? "en divisa" : formatCents(Math.round(-o.cashEur * 100), "EUR", { signed: true })}
              </td>
              <td className="py-2 pl-2 text-right">
                <DeleteOperationButton id={o.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

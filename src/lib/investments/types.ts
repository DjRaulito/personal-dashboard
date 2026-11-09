export type AssetKind = "fund" | "stock" | "etf" | "pension" | "other";
export type OperationType = "buy" | "sell" | "dividend" | "fee";
export type Broker = "myinvestor" | "mexem" | "other";
export type OperationSource = "investing" | "myinvestor" | "mexem" | "manual";

/** Activo tal y como sale de los importadores (antes de guardarse). */
export interface DraftAsset {
  key: string; // identificador estable dentro de la importación (ISIN o símbolo)
  name: string;
  isin: string | null;
  symbol: string | null; // símbolo de Investing
  market: string | null;
  kind: AssetKind;
  currency: string; // moneda de cotización (GBX = peniques)
  broker: Broker;
}

export interface DraftOperation {
  assetKey: string;
  type: OperationType;
  date: string; // YYYY-MM-DD (fecha de la operación)
  quantity: number; // participaciones/títulos (0 en dividendos y comisiones)
  price: number | null; // en la moneda del activo
  /** Efectivo en EUR: positivo = sale dinero (compra/comisión), negativo = entra (venta/dividendo). */
  cashEur: number | null;
  /** Importe bruto en la moneda del activo (para convertir con el cambio del día si falta cashEur). */
  grossLocal: number | null;
  source: OperationSource;
  externalId: string; // para no duplicar al reimportar
  /** Cambio de títulos por contrasplit/equiparación (sin dinero). */
  split?: boolean;
}

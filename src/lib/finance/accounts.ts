export const ACCOUNT_TYPES = ["bank", "savings", "card", "cash", "broker", "betting"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Cuenta corriente",
  savings: "Ahorro",
  card: "Tarjeta de crédito",
  cash: "Efectivo",
  broker: "Broker / inversión",
  betting: "Casa de apuestas",
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
  archived: boolean;
  /** Casas de apuestas: saldo apuntado a mano (manda sobre la suma de movimientos). */
  manual_balance_cents?: number | null;
  manual_balance_on?: string | null;
}

export interface AccountWithBalance extends Account {
  balance_cents: number;
}

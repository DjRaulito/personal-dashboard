export const ACCOUNT_TYPES = ["bank", "savings", "card", "cash", "broker"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Cuenta corriente",
  savings: "Ahorro",
  card: "Tarjeta de crédito",
  cash: "Efectivo",
  broker: "Broker / inversión",
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
  archived: boolean;
}

export interface AccountWithBalance extends Account {
  balance_cents: number;
}

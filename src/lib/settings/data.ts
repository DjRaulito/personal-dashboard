// Ajustes → Datos: qué se exporta y qué tablas borra cada módulo.
import type { Database } from "@/lib/supabase/database.types";

export type TableName = keyof Database["public"]["Tables"];

/** Lo que se exporta. Fuera: integraciones (tokens de Google) y tokens del cerebro (secretos). */
export const EXPORT_TABLES = [
  "profiles",
  "accounts",
  "categories",
  "rules",
  "transactions",
  "budgets",
  "savings_goals",
  "recurring_payments",
  "import_profiles",
  "assets",
  "asset_prices",
  "investment_operations",
  "fx_rates",
  "property_settings",
  "property_listings",
  "property_price_history",
  "property_runs",
  "nutrition_settings",
  "nutrition_foods",
  "nutrition_plans",
  "nutrition_plan_meals",
  "nutrition_plan_groups",
  "nutrition_plan_options",
  "nutrition_logs",
  "nutrition_meal_checks",
  "nutrition_cheats",
  "nutrition_reviews",
  "nutrition_shopping_picks",
  "body_measurements",
  "wardrobe_settings",
  "wardrobe_garments",
  "wardrobe_outfits",
  "wardrobe_outfit_items",
  "brain_memories",
  "brain_links",
] as const satisfies readonly TableName[];

export type DataModule = "finanzas" | "nutricion" | "armario" | "cerebro";

/** Tablas de cada módulo, de hijas a madres para que el borrado no choque con las claves ajenas. */
export const MODULE_TABLES: Record<DataModule, { label: string; tables: readonly TableName[] }> = {
  finanzas: {
    label: "Finanzas",
    tables: [
      "transactions",
      "rules",
      "budgets",
      "savings_goals",
      "recurring_payments",
      "import_profiles",
      "accounts",
      "categories",
      "investment_operations",
      "asset_prices",
      "assets",
      "fx_rates",
    ],
  },
  nutricion: {
    label: "Nutrición",
    tables: [
      "nutrition_plan_options",
      "nutrition_plan_groups",
      "nutrition_plan_meals",
      "nutrition_plans",
      "nutrition_meal_checks",
      "nutrition_logs",
      "nutrition_cheats",
      "nutrition_reviews",
      "nutrition_shopping_picks",
      "nutrition_foods",
      "nutrition_settings",
      "body_measurements",
    ],
  },
  armario: {
    label: "Armario",
    tables: ["wardrobe_outfit_items", "wardrobe_outfits", "wardrobe_garments", "wardrobe_settings"],
  },
  cerebro: { label: "Cerebro", tables: ["brain_links", "brain_memories"] },
};

/** Lo que hay que escribir para confirmar el borrado de un módulo. */
export const confirmWord = (module: DataModule) => `borrar ${MODULE_TABLES[module].label.toLowerCase()}`;

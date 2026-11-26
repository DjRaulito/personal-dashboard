"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/(app)/tareas/inmuebles/actions";
import { buttonClass, Field, FormMessage, inputClass, Tile, TileTitle } from "@/components/ui";
import type { PropertySettings } from "@/lib/realestate/schemas";

type NumField = { name: string; label: string; value: number; step?: string; suffix?: string };

function NumberInput({ f, error }: { f: NumField; error?: string }) {
  return (
    <Field label={f.suffix ? `${f.label} (${f.suffix})` : f.label} error={error}>
      <input
        name={f.name}
        type="number"
        inputMode="decimal"
        step={f.step ?? "any"}
        min={0}
        required
        defaultValue={f.value}
        className={inputClass}
      />
    </Field>
  );
}

export function SettingsForm({ settings }: { settings: PropertySettings }) {
  const [state, action, pending] = useActionState(saveSettings, { ok: false });
  const { assumptions: a, criteria: c } = settings;
  const e = state.errors ?? {};

  const criteria: NumField[] = [
    { name: "price_min_eur", label: "Precio mínimo", value: c.price_min_eur, suffix: "€" },
    { name: "price_max_eur", label: "Precio máximo", value: c.price_max_eur, suffix: "€" },
    {
      name: "price_exceptional_eur",
      label: "Tope excepcional (solo negociando)",
      value: c.price_exceptional_eur,
      suffix: "€",
    },
    { name: "max_equity_eur", label: "Aportación máxima (entrada + ITP)", value: c.max_equity_eur, suffix: "€" },
    {
      name: "roi_opportunity_pct",
      label: "ROI con apalancamiento para «oportunidad»",
      value: c.roi_opportunity_pct,
      suffix: "%",
    },
    { name: "roi_option_pct", label: "ROI con apalancamiento para «opción»", value: c.roi_option_pct, suffix: "%" },
    { name: "gross_min_pct", label: "Rentabilidad bruta mínima", value: c.gross_min_pct, suffix: "%" },
    { name: "gross_target_pct", label: "Rentabilidad bruta objetivo", value: c.gross_target_pct, suffix: "%" },
  ];
  const purchase: NumField[] = [
    { name: "itp_pct", label: "ITP", value: a.itp_pct, suffix: "%" },
    {
      name: "appraisal_eur",
      label: "Notaría, registro, gestoría y tasación",
      value: a.appraisal_eur,
      suffix: "€",
    },
    { name: "purchase_costs_pct", label: "Gastos extra sobre el precio", value: a.purchase_costs_pct, suffix: "%" },
    { name: "reform_contingency_pct", label: "Imprevistos de reforma", value: a.reform_contingency_pct, suffix: "%" },
    { name: "setup_eur", label: "Cédula, certificados y altas", value: a.setup_eur, suffix: "€" },
  ];
  const financing: NumField[] = [
    { name: "ltv_pct", label: "Financiación principal", value: a.ltv_pct, suffix: "% del precio" },
    { name: "ltv_alt_pct", label: "Financiación a comparar", value: a.ltv_alt_pct, suffix: "% del precio" },
    { name: "interest_pct", label: "Tipo de interés fijo", value: a.interest_pct, suffix: "%" },
    { name: "term_years", label: "Plazo", value: a.term_years, suffix: "años", step: "1" },
    { name: "stress_interest_pct", label: "Tipo de la prueba de estrés", value: a.stress_interest_pct, suffix: "%" },
  ];
  const appreciation: NumField[] = [
    {
      name: "appreciation_conservative_pct",
      label: "Conservadora",
      value: a.appreciation_conservative_pct,
      suffix: "% al año",
    },
    { name: "appreciation_base_pct", label: "Base", value: a.appreciation_base_pct, suffix: "% al año" },
    {
      name: "appreciation_optimistic_pct",
      label: "Optimista",
      value: a.appreciation_optimistic_pct,
      suffix: "% al año",
    },
  ];
  const operating: NumField[] = [
    { name: "vacancy_months", label: "Vacancia", value: a.vacancy_months, suffix: "meses al año" },
    { name: "maintenance_pct", label: "Mantenimiento", value: a.maintenance_pct, suffix: "% de la renta" },
    { name: "management_pct", label: "Gestión", value: a.management_pct, suffix: "% de lo cobrado" },
    {
      name: "default_insurance_pct",
      label: "Seguro de impago",
      value: a.default_insurance_pct,
      suffix: "% de la renta",
    },
    { name: "home_insurance_eur", label: "Seguro del hogar", value: a.home_insurance_eur, suffix: "€/año" },
    {
      name: "community_default_eur",
      label: "Comunidad si no se sabe",
      value: a.community_default_eur,
      suffix: "€/mes",
    },
    { name: "ibi_default_eur", label: "IBI si no se sabe", value: a.ibi_default_eur, suffix: "€/año" },
  ];
  const weights: NumField[] = [
    { name: "w_cashflow", label: "ROI con apalancamiento y cash flow", value: c.weights.cashflow },
    { name: "w_net_yield", label: "Rentabilidad neta", value: c.weights.net_yield },
    { name: "w_price", label: "Precio frente a comparables", value: c.weights.price },
    { name: "w_demand", label: "Demanda de alquiler", value: c.weights.demand },
    { name: "w_appreciation", label: "Revalorización", value: c.weights.appreciation },
    { name: "w_safety", label: "Seguridad", value: c.weights.safety },
  ];

  const grid = (fields: NumField[]) => (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <NumberInput key={f.name} f={f} error={e[f.name.replace(/^w_/, "")] ?? e[f.name]} />
      ))}
    </div>
  );

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <Tile>
        <TileTitle>Qué buscas</TileTitle>
        <p className="text-muted mt-1 text-sm">La tarea de Cowork lee esto cada día antes de buscar.</p>
        <div className="mt-4 grid gap-3">
          <Field label="Municipios y barrios, por orden de prioridad (separados por comas)" error={e.zones}>
            <textarea name="zones" rows={3} maxLength={1000} defaultValue={c.zones} className={inputClass} />
          </Field>
        </div>
        {grid(criteria)}
        <div className="mt-3">
          <Field label="Notas para la búsqueda (opcional)" error={e.notes}>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={c.notes}
              placeholder="Prefiero pisos con ascensor, evitar bajos…"
              className={inputClass}
            />
          </Field>
        </div>
      </Tile>

      <Tile>
        <TileTitle>Compra</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Impuestos y gastos de Cataluña. Revisa el ITP: depende del precio y de tu situación.
        </p>
        {grid(purchase)}
      </Tile>

      <Tile>
        <TileTitle>Hipoteca</TileTitle>
        {grid(financing)}
      </Tile>

      <Tile>
        <TileTitle>Revalorización</TileTitle>
        <p className="text-muted mt-1 text-sm">
          Se usa si la tarea no trae la de la zona. Es informativa: no cuenta para clasificar.
        </p>
        {grid(appreciation)}
      </Tile>

      <Tile>
        <TileTitle>Gastos del alquiler</TileTitle>
        <p className="text-muted mt-1 text-sm">Si el anuncio trae la comunidad o el IBI, se usan esos.</p>
        {grid(operating)}
      </Tile>

      <Tile>
        <TileTitle>Pesos de la puntuación</TileTitle>
        <p className="text-muted mt-1 text-sm">Se reparten sobre 100 en proporción a estos números.</p>
        {grid(weights)}
      </Tile>

      <div className="bg-bg/90 sticky bottom-20 z-10 flex flex-wrap items-center gap-3 py-2 md:bottom-0">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Guardando…" : "Guardar y recalcular"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

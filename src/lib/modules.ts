export type ModuleKey = "finanzas" | "calendario" | "contenido" | "gimnasio" | "nutricion" | "agentes";

export interface AppModule {
  key: ModuleKey;
  label: string;
  phase: number;
  description: string;
  /** Clase de Tailwind con el color del módulo (ver DESIGN.md) */
  color: string;
}

export const MODULES: readonly AppModule[] = [
  {
    key: "finanzas",
    label: "Finanzas",
    phase: 2,
    description: "Cuentas, gastos, presupuestos e inversiones",
    color: "bg-finance",
  },
  {
    key: "calendario",
    label: "Calendario",
    phase: 1,
    description: "Tu agenda de Google y los pagos próximos",
    color: "bg-content",
  },
  {
    key: "contenido",
    label: "Contenido",
    phase: 4,
    description: "Ideas y guiones para YouTube, Instagram y TikTok",
    color: "bg-content",
  },
  { key: "gimnasio", label: "Gimnasio", phase: 5, description: "Entrenos de Hevy, volumen y récords", color: "bg-gym" },
  {
    key: "nutricion",
    label: "Nutrición",
    phase: 6,
    description: "Kcal, macros, comidas y peso",
    color: "bg-nutrition",
  },
  {
    key: "agentes",
    label: "Agentes",
    phase: 8,
    description: "Tareas en paralelo para tus agentes",
    color: "bg-attention",
  },
] as const;

export function modulesByPhase(modules: readonly AppModule[] = MODULES): AppModule[] {
  return [...modules].sort((a, b) => a.phase - b.phase || a.label.localeCompare(b.label, "es"));
}

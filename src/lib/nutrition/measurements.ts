import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Medidas corporales (peso y perímetros), de la más reciente a la más antigua. */
export async function getMeasurements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select(
      "id, measured_on, weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, thigh_cm, shoulder_cm, abdomen_cm, hip_cm, calf_cm, notes",
    )
    .order("measured_on", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const n = (v: number | null) => (v === null ? null : Number(v));
  return (data ?? []).map((m) => ({
    ...m,
    weight_kg: n(m.weight_kg),
    body_fat_pct: n(m.body_fat_pct),
    waist_cm: n(m.waist_cm),
    chest_cm: n(m.chest_cm),
    arm_cm: n(m.arm_cm),
    thigh_cm: n(m.thigh_cm),
    shoulder_cm: n(m.shoulder_cm),
    abdomen_cm: n(m.abdomen_cm),
    hip_cm: n(m.hip_cm),
    calf_cm: n(m.calf_cm),
  }));
}

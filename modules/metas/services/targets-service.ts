import { createClient } from "@/lib/supabase/server";
import type { KpiTargetInput } from "@/lib/validations/schemas";
import { kpiTargetSchema } from "@/lib/validations/schemas";

export async function listTargets(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_targets")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("fecha_inicio", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTarget(input: KpiTargetInput, userId: string) {
  const parsed = kpiTargetSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_targets")
    .insert({ ...parsed, created_by: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTarget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("kpi_targets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listTrafficLightRanges(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_traffic_light_ranges")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("vigencia_desde", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertTrafficLightRange(
  kpiId: string,
  ranges: {
    cumplimiento_min_pct: number;
    riesgo_min_pct: number;
    riesgo_max_pct: number;
    incumplimiento_max_pct: number;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_traffic_light_ranges")
    .upsert(
      { kpi_id: kpiId, vigencia_desde: new Date().toISOString().slice(0, 10), ...ranges },
      { onConflict: "kpi_id,vigencia_desde" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

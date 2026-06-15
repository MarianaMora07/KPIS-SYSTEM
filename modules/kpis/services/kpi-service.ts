import { createClient } from "@/lib/supabase/server";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import { kpiCreateSchema } from "@/lib/validations/schemas";

export async function listKpis() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpis")
    .select("*, kpi_categories(nombre)")
    .eq("estado", "activo")
    .order("nombre");

  if (error) throw new Error(error.message);
  return data;
}

export async function createKpi(input: KpiCreateInput) {
  const parsed = kpiCreateSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .insert(parsed)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function inactivateKpi(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("kpis")
    .update({ estado: "inactivo" })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

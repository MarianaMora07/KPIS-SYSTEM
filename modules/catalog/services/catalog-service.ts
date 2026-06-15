import { createClient } from "@/lib/supabase/server";

export async function listRegions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regions")
    .select("id, codigo, nombre")
    .eq("estado", "activo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listHotels(regionId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("hotels")
    .select("id, codigo, nombre, region_id")
    .eq("estado", "activo")
    .order("nombre");
  if (regionId) query = query.eq("region_id", regionId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listKpiCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_categories")
    .select("id, codigo, nombre")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

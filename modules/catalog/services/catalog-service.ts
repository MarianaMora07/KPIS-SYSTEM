import { createClient } from "@/lib/supabase/server";
import { withCache } from "@/lib/cache/dashboard-cache";

const CATALOG_TTL_MS = 5 * 60_000;

export async function listRegions() {
  return withCache(
    "catalog:regions",
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("regions")
        .select("id, codigo, nombre")
        .eq("estado", "activo")
        .order("nombre");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    CATALOG_TTL_MS
  );
}

export async function listHotels(regionId?: string) {
  const cacheKey = regionId ? `catalog:hotels:${regionId}` : "catalog:hotels:all";
  return withCache(
    cacheKey,
    async () => {
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
    },
    CATALOG_TTL_MS
  );
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

export async function listBusinessUnits(hotelId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("business_units")
    .select("id, codigo, nombre, hotel_id")
    .eq("estado", "activo")
    .order("nombre");
  if (hotelId) query = query.eq("hotel_id", hotelId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSalesChannels() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_channels")
    .select("id, codigo, nombre")
    .eq("estado", "activo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMarketingCampaigns(regionId?: string, hotelId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("marketing_campaigns")
    .select("id, codigo, nombre, region_id, hotel_id")
    .eq("estado", "activo")
    .order("nombre");
  if (regionId) query = query.eq("region_id", regionId);
  if (hotelId) query = query.eq("hotel_id", hotelId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCommercialTeams(hotelId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("commercial_teams")
    .select("id, codigo, nombre, hotel_id")
    .eq("estado", "activo")
    .order("nombre");
  if (hotelId) query = query.eq("hotel_id", hotelId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listUsersForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, nombre, apellido, email")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({
    id: u.id,
    nombre: `${u.nombre} ${u.apellido ?? ""}`.trim(),
  }));
}

// CRUD regiones/hoteles (admin)
export async function createRegion(input: {
  codigo: string;
  nombre: string;
  descripcion?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regions")
    .insert({ ...input, estado: "activo" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createHotel(input: {
  region_id: string;
  codigo: string;
  nombre: string;
  ciudad?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hotels")
    .insert({ ...input, estado: "activo" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

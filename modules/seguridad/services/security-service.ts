import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";
import type { AuditLogRow, PermissionRow, UserWithScopes } from "../types";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, user_roles(rol)")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listUsers(): Promise<UserWithScopes[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      `
      id, email, nombre, apellido, activo,
      user_roles(rol),
      user_hotel_scopes(hotel_id),
      user_region_scopes(region_id)
    `
    )
    .order("nombre");

  if (error) throw new Error(error.message);

  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    apellido: u.apellido,
    activo: u.activo,
    roles: ((u.user_roles as { rol: AppRole }[]) ?? []).map((r) => r.rol),
    hotel_ids: ((u.user_hotel_scopes as { hotel_id: string }[]) ?? []).map(
      (h) => h.hotel_id
    ),
    region_ids: ((u.user_region_scopes as { region_id: string }[]) ?? []).map(
      (r) => r.region_id
    ),
  }));
}

export async function listAuditLogs(filters?: {
  entidad?: string;
  limit?: number;
}): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.entidad) query = query.eq("entidad", filters.entidad);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogRow[];
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("codigo, descripcion, modulo")
    .order("modulo");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listRolePermissions(rol: AppRole) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permissions(codigo, descripcion, modulo)")
    .eq("rol", rol);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function assignRole(
  userId: string,
  rol: AppRole,
  asignadoPor: string
) {
  const supabase = await createClient();
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    rol,
    asignado_por: asignadoPor,
  });
  if (error) throw new Error(error.message);
}

export async function revokeRole(userId: string, rol: AppRole) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("rol", rol);
  if (error) throw new Error(error.message);
}

export async function setUserActive(userId: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ activo })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function setUserHotelScopes(userId: string, hotelIds: string[]) {
  const supabase = await createClient();
  await supabase.from("user_hotel_scopes").delete().eq("user_id", userId);
  if (hotelIds.length > 0) {
    const { error } = await supabase.from("user_hotel_scopes").insert(
      hotelIds.map((hotel_id) => ({ user_id: userId, hotel_id }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function setUserRegionScopes(userId: string, regionIds: string[]) {
  const supabase = await createClient();
  await supabase.from("user_region_scopes").delete().eq("user_id", userId);
  if (regionIds.length > 0) {
    const { error } = await supabase.from("user_region_scopes").insert(
      regionIds.map((region_id) => ({ user_id: userId, region_id }))
    );
    if (error) throw new Error(error.message);
  }
}

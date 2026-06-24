import { createClient } from "@/lib/supabase/server";
import { PERMISSION_CATALOG } from "@/lib/auth/role-matrix";
import type { AppRole } from "@/types/database";
import type { AuditLogFilters, AuditLogRow, PermissionRow, UserWithScopes } from "../types";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, user_roles!user_roles_user_id_fkey(rol)")
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
      user_roles!user_roles_user_id_fkey(rol),
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

export async function listAuditLogs(
  filters?: AuditLogFilters
): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.entidad) {
    query = query.ilike("entidad", `%${filters.entidad}%`);
  }
  if (filters?.entidadId) query = query.eq("entidad_id", filters.entidadId);
  if (filters?.usuarioEmail) {
    query = query.ilike("usuario_email", `%${filters.usuarioEmail}%`);
  }
  if (filters?.fechaDesde) query = query.gte("fecha", filters.fechaDesde);
  if (filters?.fechaHasta) query = query.lte("fecha", filters.fechaHasta);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogRow[];
}

export async function buildAuditNamesMap(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const namesMap: Record<string, string> = {};

  const [
    profilesRes,
    categoriesRes,
    hotelsRes,
    regionsRes,
    kpisRes,
    businessUnitsRes,
    salesChannelsRes,
    campaignsRes,
    teamsRes,
  ] = await Promise.all([
    supabase.from("user_profiles").select("id, nombre, apellido, email"),
    supabase.from("kpi_categories").select("id, nombre"),
    supabase.from("hotels").select("id, nombre"),
    supabase.from("regions").select("id, nombre"),
    supabase.from("kpis").select("id, nombre, codigo"),
    supabase.from("business_units").select("id, nombre"),
    supabase.from("sales_channels").select("id, nombre"),
    supabase.from("marketing_campaigns").select("id, nombre"),
    supabase.from("commercial_teams").select("id, nombre"),
  ]);

  for (const p of profilesRes.data ?? []) {
    const name =
      [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || p.email;
    if (name) namesMap[p.id] = name;
  }

  for (const rows of [
    categoriesRes.data,
    hotelsRes.data,
    regionsRes.data,
    businessUnitsRes.data,
    salesChannelsRes.data,
    campaignsRes.data,
    teamsRes.data,
  ]) {
    for (const row of rows ?? []) {
      const r = row as { id: string; nombre: string };
      if (r.nombre) namesMap[r.id] = r.nombre;
    }
  }

  for (const k of kpisRes.data ?? []) {
    if (k.nombre) namesMap[k.id] = `${k.nombre} (${k.codigo})`;
  }

  return namesMap;
}

export async function listAuditFilterSuggestions(): Promise<{
  emails: string[];
  entidades: string[];
}> {
  const supabase = await createClient();

  const [profilesRes, logsRes] = await Promise.all([
    supabase.from("user_profiles").select("email").order("email"),
    supabase.from("audit_logs").select("usuario_email, entidad").limit(1000),
  ]);

  const emails = new Set<string>();
  for (const profile of profilesRes.data ?? []) {
    if (profile.email) emails.add(profile.email);
  }
  for (const log of logsRes.data ?? []) {
    if (log.usuario_email) emails.add(log.usuario_email);
  }

  const entidades = new Set<string>();
  for (const log of logsRes.data ?? []) {
    if (log.entidad) entidades.add(log.entidad);
  }

  return {
    emails: [...emails].sort((a, b) => a.localeCompare(b)),
    entidades: [...entidades].sort((a, b) => a.localeCompare(b)),
  };
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("codigo, descripcion, modulo")
    .order("modulo");

  if (error) throw new Error(error.message);
  if ((data ?? []).length > 0) return data ?? [];

  console.warn(
    "[listPermissions] Sin filas en permissions — usando catálogo estático (¿falta política RLS?)"
  );
  return PERMISSION_CATALOG;
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

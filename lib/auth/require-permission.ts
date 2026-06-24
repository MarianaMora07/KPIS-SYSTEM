import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";
import { getUserPermissions } from "./permissions";
import {
  canAccessAuditoriaUi,
  canAccessSeguridadUi,
  hasPermissionInList,
  type PermissionCode,
} from "./role-matrix";

export async function requirePermission(
  codigo: PermissionCode | string,
  redirectTo = "/dashboard"
): Promise<{ rol: AppRole; permissions: string[] }> {
  const { rol, permissions } = await getUserPermissions();
  if (!rol || !hasPermissionInList(permissions, codigo)) {
    redirect(redirectTo);
  }
  return { rol, permissions };
}

/** Lanza error si el usuario no tiene el permiso (server actions). */
export async function assertPermission(
  codigo: PermissionCode | string
): Promise<{ rol: AppRole; permissions: string[] }> {
  const { rol, permissions } = await getUserPermissions();
  if (!rol || !hasPermissionInList(permissions, codigo)) {
    throw new Error("No tiene permiso para esta acción");
  }
  return { rol, permissions };
}

export async function requireSeguridadUi(
  redirectTo = "/dashboard"
): Promise<{ rol: AppRole; permissions: string[] }> {
  const { rol, permissions } = await getUserPermissions();
  if (!canAccessSeguridadUi(rol)) {
    redirect(redirectTo);
  }
  return { rol: rol!, permissions };
}

export async function requireAuditoriaAccess(
  redirectTo = "/dashboard"
): Promise<{ rol: AppRole; permissions: string[] }> {
  const { rol, permissions } = await getUserPermissions();
  if (!canAccessAuditoriaUi(rol, permissions)) {
    redirect(redirectTo);
  }
  return { rol: rol!, permissions };
}

/** Lanza error si el usuario no puede ver auditoría (server actions). */
export async function assertAuditoriaAccess(): Promise<{
  rol: AppRole;
  permissions: string[];
}> {
  const { rol, permissions } = await getUserPermissions();
  if (!canAccessAuditoriaUi(rol, permissions)) {
    throw new Error("No tiene permiso para ver la bitácora de auditoría");
  }
  return { rol: rol!, permissions };
}

export async function getUserHotelScopeIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_hotel_scopes")
    .select("hotel_id")
    .eq("user_id", user.id);

  return (data ?? []).map((r) => r.hotel_id);
}

export async function requireKpiEditAccess(
  _kpiHotelId: string | null,
  redirectTo = "/kpis"
): Promise<{ rol: AppRole; permissions: string[] }> {
  return requirePermission("kpis.editar", redirectTo);
}

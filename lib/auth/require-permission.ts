import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";
import { getUserPermissions } from "./permissions";
import {
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

export async function requireSeguridadUi(
  redirectTo = "/dashboard"
): Promise<{ rol: AppRole; permissions: string[] }> {
  const { rol, permissions } = await getUserPermissions();
  if (!canAccessSeguridadUi(rol)) {
    redirect(redirectTo);
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
  kpiHotelId: string | null,
  redirectTo = "/kpis"
): Promise<{ rol: AppRole; permissions: string[] }> {
  const { rol, permissions } = await requirePermission("kpis.editar", redirectTo);

  if (rol === "gerente_hotel") {
    if (!kpiHotelId) redirect(redirectTo);
    const scopes = await getUserHotelScopeIds();
    if (!scopes.includes(kpiHotelId)) redirect(redirectTo);
  }

  return { rol, permissions };
}

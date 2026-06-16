import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";
import {
  canAccessSeguridadUi,
  canManageKpisFromList,
  getPermissionsForRole,
  hasPermissionInList,
} from "./role-matrix";

export async function getUserPermissions(): Promise<{
  rol: AppRole | null;
  permissions: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { rol: null, permissions: [] };

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("rol")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("[getUserPermissions] user_roles:", rolesError.message);
  }

  const rol = (roles?.[0]?.rol as AppRole) ?? null;
  if (!rol) return { rol: null, permissions: [] };

  const { data: perms, error: permsError } = await supabase
    .from("role_permissions")
    .select("permissions(codigo)")
    .eq("rol", rol);

  if (permsError) {
    console.error("[getUserPermissions] role_permissions:", permsError.message);
  }

  const permissions = (perms ?? [])
    .map((p) => {
      const perm = p.permissions as { codigo: string } | { codigo: string }[] | null;
      if (Array.isArray(perm)) return perm[0]?.codigo;
      return perm?.codigo;
    })
    .filter(Boolean) as string[];

  if (permissions.length === 0) {
    return { rol, permissions: getPermissionsForRole(rol) };
  }

  return { rol, permissions };
}

export function hasPermission(
  permissions: string[],
  codigo: string
): boolean {
  return hasPermissionInList(permissions, codigo);
}

export function canAccessSeguridad(rol: AppRole | null): boolean {
  return canAccessSeguridadUi(rol);
}

export function canManageKpis(permissions: string[]): boolean {
  return canManageKpisFromList(permissions);
}

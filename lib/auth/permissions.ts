import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

const ADMIN_ROLES: AppRole[] = ["administrador", "analista"];

export async function getUserPermissions(): Promise<{
  rol: AppRole | null;
  permissions: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { rol: null, permissions: [] };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("rol")
    .eq("user_id", user.id);

  const rol = (roles?.[0]?.rol as AppRole) ?? null;
  if (!rol) return { rol: null, permissions: [] };

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permissions(codigo)")
    .eq("rol", rol);

  const permissions = (perms ?? [])
    .map((p) => {
      const perm = p.permissions as { codigo: string } | { codigo: string }[] | null;
      if (Array.isArray(perm)) return perm[0]?.codigo;
      return perm?.codigo;
    })
    .filter(Boolean) as string[];

  return { rol, permissions };
}

export function hasPermission(
  permissions: string[],
  codigo: string
): boolean {
  return permissions.includes(codigo);
}

export function canAccessSeguridad(rol: AppRole | null): boolean {
  return rol !== null && ADMIN_ROLES.includes(rol);
}

export function canManageKpis(permissions: string[]): boolean {
  return (
    permissions.includes("kpis.crear") || permissions.includes("kpis.editar")
  );
}

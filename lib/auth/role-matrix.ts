import type { AppRole } from "@/types/database";

/** Códigos de permiso alineados con HU-KPI-001..012 y docs/test-matrix-roles.md */
export const PERMISSION_CODES = [
  "kpis.crear",
  "kpis.editar",
  "kpis.inactivar",
  "kpis.ver",
  "metas.configurar",
  "dashboard.ver",
  "import.cargar",
  "integraciones.gestionar",
  "reportes.exportar",
  "catalogo.ver",
  "catalogo.gestionar",
  "alertas.ver",
  "planes.gestionar",
  "usuarios.gestionar",
  "auditoria.ver",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

const ADMIN_PERMISSIONS: PermissionCode[] = [...PERMISSION_CODES];

const DIRECTOR_PERMISSIONS: PermissionCode[] = [
  "dashboard.ver",
  "kpis.ver",
  "reportes.exportar",
  "catalogo.ver",
];

const GERENTE_PERMISSIONS: PermissionCode[] = [
  "dashboard.ver",
  "kpis.ver",
  "metas.configurar",
  "import.cargar",
  "reportes.exportar",
  "alertas.ver",
  "planes.gestionar",
];

const ANALISTA_PERMISSIONS: PermissionCode[] = [
  "dashboard.ver",
  "kpis.ver",
  "import.cargar",
  "integraciones.gestionar",
  "reportes.exportar",
];

const CONSULTA_PERMISSIONS: PermissionCode[] = [
  "dashboard.ver",
  "kpis.ver",
  "reportes.exportar",
];

/**
 * Matriz estática por rol — debe coincidir con role_permissions en Supabase.
 */
export const ROLE_PERMISSIONS: Record<AppRole, readonly PermissionCode[]> = {
  administrador: ADMIN_PERMISSIONS,
  director_comercial: DIRECTOR_PERMISSIONS,
  director_mercadeo: DIRECTOR_PERMISSIONS,
  gerente_hotel: GERENTE_PERMISSIONS,
  analista: ANALISTA_PERMISSIONS,
  consulta: CONSULTA_PERMISSIONS,
};

const CATALOGO_UI_ROLES: AppRole[] = [
  "administrador",
  "director_comercial",
  "director_mercadeo",
];

export function getPermissionsForRole(rol: AppRole): PermissionCode[] {
  return [...ROLE_PERMISSIONS[rol]];
}

export function roleHasPermission(
  rol: AppRole | null | undefined,
  codigo: PermissionCode | string
): boolean {
  if (!rol) return false;
  return ROLE_PERMISSIONS[rol].includes(codigo as PermissionCode);
}

export function canAccessSeguridadUi(rol: AppRole | null | undefined): boolean {
  return rol === "administrador";
}

export function canAccessCatalogoUi(rol: AppRole | null | undefined): boolean {
  return rol != null && CATALOGO_UI_ROLES.includes(rol);
}

export function canManageUsers(rol: AppRole | null | undefined): boolean {
  return rol === "administrador";
}

export function canCreateKpis(rol: AppRole | null | undefined): boolean {
  return roleHasPermission(rol, "kpis.crear");
}

export function canEditKpis(rol: AppRole | null | undefined): boolean {
  return roleHasPermission(rol, "kpis.editar");
}

export function canViewKpis(rol: AppRole | null | undefined): boolean {
  return roleHasPermission(rol, "kpis.ver");
}

export function canManageCatalog(rol: AppRole | null | undefined): boolean {
  return roleHasPermission(rol, "catalogo.gestionar");
}

export function canManageActionPlans(rol: AppRole | null | undefined): boolean {
  return roleHasPermission(rol, "planes.gestionar");
}

export function hasPermissionInList(
  permissions: string[],
  codigo: PermissionCode | string
): boolean {
  return permissions.includes(codigo);
}

export function canManageKpisFromList(permissions: string[]): boolean {
  return (
    hasPermissionInList(permissions, "kpis.crear") ||
    hasPermissionInList(permissions, "kpis.editar")
  );
}

export function canViewKpisFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "kpis.ver");
}

export function canExportReportsFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "reportes.exportar");
}

export function canImportFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "import.cargar");
}

export function canManageIntegrationsFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "integraciones.gestionar");
}

export function canConfigureMetasFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "metas.configurar");
}

export function canManageActionPlansFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "planes.gestionar");
}

export function canManageCatalogFromList(permissions: string[]): boolean {
  return hasPermissionInList(permissions, "catalogo.gestionar");
}

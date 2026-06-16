import type { AppRole } from "@/types/database";

/** Códigos de permiso alineados con HU-KPI-001..012 y docs/test-matrix-roles.md */
export const PERMISSION_CODES = [
  "kpis.crear",
  "kpis.editar",
  "kpis.inactivar",
  "metas.configurar",
  "dashboard.ver",
  "import.cargar",
  "integraciones.gestionar",
  "reportes.exportar",
  "usuarios.gestionar",
  "auditoria.ver",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

const ALL_EXCEPT_USERS: PermissionCode[] = PERMISSION_CODES.filter(
  (p) => p !== "usuarios.gestionar"
);

const KPI_WRITE_ROLES: PermissionCode[] = [
  "kpis.crear",
  "kpis.editar",
  "kpis.inactivar",
  "metas.configurar",
  "dashboard.ver",
  "import.cargar",
  "integraciones.gestionar",
  "reportes.exportar",
  "auditoria.ver",
];

/**
 * Matriz estática por rol — debe coincidir con role_permissions en Supabase.
 * HU-001/002/003: kpis.* y metas.configurar
 * HU-004: import.cargar
 * HU-005: integraciones.gestionar
 * HU-006/007: dashboard.ver
 * HU-010: reportes.exportar
 * HU-011: usuarios.gestionar, auditoria.ver
 */
export const ROLE_PERMISSIONS: Record<AppRole, readonly PermissionCode[]> = {
  administrador: PERMISSION_CODES,
  director_comercial: ALL_EXCEPT_USERS,
  director_mercadeo: ALL_EXCEPT_USERS.filter(
    (p) => p !== "integraciones.gestionar"
  ),
  gerente_hotel: [
    "dashboard.ver",
    "reportes.exportar",
    "import.cargar",
    "metas.configurar",
    "kpis.editar",
  ],
  analista: ALL_EXCEPT_USERS,
  consulta: ["dashboard.ver", "reportes.exportar"],
};

const SEGURIDAD_UI_ROLES: AppRole[] = ["administrador", "analista"];

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
  return rol != null && SEGURIDAD_UI_ROLES.includes(rol);
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

export { KPI_WRITE_ROLES };

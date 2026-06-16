import type { AppRole } from "@/types/database";
import { canCreateKpis, canEditKpis, canManageUsers } from "./role-matrix";

const ROLE_LABELS: Record<AppRole, string> = {
  administrador: "Administrador",
  director_comercial: "Director Comercial",
  director_mercadeo: "Director Mercadeo",
  gerente_hotel: "Gerente Hotel",
  analista: "Analista",
  consulta: "Consulta",
};

const FULL_ACCESS_ROLES: AppRole[] = [
  "administrador",
  "director_comercial",
  "director_mercadeo",
  "analista",
];

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}

export function hasFullAccess(role: AppRole | null | undefined): boolean {
  return role != null && FULL_ACCESS_ROLES.includes(role);
}

export { canManageUsers };

export function canWriteKpis(role: AppRole | null | undefined): boolean {
  return canCreateKpis(role) || canEditKpis(role);
}

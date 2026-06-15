import type { AppRole } from "@/types/database";

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

export function canManageUsers(role: AppRole | null | undefined): boolean {
  return role === "administrador";
}

export function canWriteKpis(role: AppRole | null | undefined): boolean {
  return role != null && role !== "consulta" && role !== "gerente_hotel";
}

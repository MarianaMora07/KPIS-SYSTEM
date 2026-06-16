import type { AppRole } from "@/types/database";

export interface UserWithScopes {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  activo: boolean;
  roles: AppRole[];
  hotel_ids: string[];
  region_ids: string[];
}

export interface AuditLogRow {
  id: string;
  usuario_email: string | null;
  fecha: string;
  hora: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  valor_anterior: unknown;
  valor_nuevo: unknown;
  created_at: string;
}

export interface PermissionRow {
  codigo: string;
  descripcion: string;
  modulo: string;
}

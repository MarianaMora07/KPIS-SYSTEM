export type AlertSeverity = "riesgo" | "critico";
export type AlertStatus = "activa" | "escalada" | "resuelta";
export type ActionPlanStatus = "abierto" | "en_progreso" | "completado" | "vencido";

export interface AlertRow {
  id: string;
  kpi_id: string;
  kpi_value_id: string | null;
  kpi_target_id?: string | null;
  hotel_id: string | null;
  region_id: string | null;
  severidad: AlertSeverity;
  estado: AlertStatus;
  mensaje: string;
  escalada: boolean;
  escalada_at: string | null;
  resuelta_at: string | null;
  created_at: string;
  kpi_nombre?: string;
  hotel_nombre?: string;
  region_nombre?: string;
}

export interface ActionPlanRow {
  id: string;
  kpi_id: string;
  alert_id: string | null;
  titulo: string;
  descripcion: string | null;
  responsable_id: string | null;
  fecha_compromiso: string;
  estado: ActionPlanStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

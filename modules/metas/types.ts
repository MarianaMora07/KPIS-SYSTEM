import type { TrafficLightStatus } from "@/types/database";

export interface MetasDashboardRow {
  id: string;
  kpi_id: string;
  kpi_codigo: string;
  kpi_nombre: string;
  unidad_medida: string;
  periodo_tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  valor_meta: number;
  hotel_id: string | null;
  hotel_nombre: string | null;
  region_id: string | null;
  region_nombre: string | null;
  valor_real: number | null;
  cumplimiento_pct: number | null;
  semaforo: TrafficLightStatus | null;
  vencida: boolean;
}

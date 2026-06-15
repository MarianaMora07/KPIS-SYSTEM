import type { TrafficLightStatus } from "@/types/database";

export interface DashboardKpiRow {
  id: string;
  kpi_id: string;
  kpi_nombre: string;
  kpi_codigo: string;
  unidad_medida: string;
  hotel_id: string | null;
  hotel_nombre: string | null;
  region_id: string | null;
  region_nombre: string | null;
  fecha: string;
  valor_real: number;
  valor_meta: number | null;
  cumplimiento_pct: number | null;
  semaforo_calculado: TrafficLightStatus | null;
  fuente: string;
}

export interface DashboardFilters {
  regionId?: string;
  hotelId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export function formatKpiValue(valor: number, unidad: string): string {
  if (unidad === "%") return `${valor.toFixed(1)}%`;
  if (unidad === "COP")
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(valor);
  return `${valor.toFixed(1)} ${unidad}`;
}

export function formatVariacion(
  actual: number,
  meta: number | null,
  unidad: string
): string | undefined {
  if (meta == null || meta === 0) return undefined;
  const diff = actual - meta;
  if (unidad === "%") return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pp`;
  const pct = ((actual - meta) / meta) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

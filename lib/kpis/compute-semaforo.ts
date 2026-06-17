import type { TrafficLightStatus } from "@/types/database";

export interface TrafficLightRangeInput {
  cumplimiento_min_pct?: number;
  riesgo_min_pct?: number;
  riesgo_max_pct?: number;
}

export function computeSemaforoFromCumplimiento(
  cumplimientoPct: number | null,
  ranges?: TrafficLightRangeInput
): TrafficLightStatus | null {
  if (cumplimientoPct == null) return null;
  const minCumplimiento = ranges?.cumplimiento_min_pct ?? 100;
  const minRiesgo = ranges?.riesgo_min_pct ?? 80;
  const maxRiesgo = ranges?.riesgo_max_pct ?? 99.99;
  if (cumplimientoPct >= minCumplimiento) return "cumplimiento";
  if (cumplimientoPct >= minRiesgo && cumplimientoPct <= maxRiesgo) return "riesgo";
  return "incumplimiento";
}

/** Misma lógica que la vista v_dashboard_kpis: usa semáforo guardado o lo deriva del cumplimiento. */
export function resolveSemaforoCalculado(
  semaforo: TrafficLightStatus | null | undefined,
  cumplimientoPct: number | null,
  ranges?: TrafficLightRangeInput
): TrafficLightStatus | null {
  return semaforo ?? computeSemaforoFromCumplimiento(cumplimientoPct, ranges);
}

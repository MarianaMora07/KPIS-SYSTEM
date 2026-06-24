import type { TrafficLightRangeInput } from "@/lib/kpis/compute-semaforo";
import { mapRawTargetsForMatch, resolveValueCompliance } from "@/lib/metas/resolve-value-compliance";
import type { DashboardKpiRow } from "../types";

type RawValueRow = {
  id: string;
  kpi_id: string;
  fecha: string;
  valor_real: number;
  fuente: string;
  hotel_id: string | null;
  region_id: string | null;
  marketing_campaign_id: string | null;
  kpis:
    | { nombre: string; codigo: string; unidad_medida: string; estado?: string }
    | { nombre: string; codigo: string; unidad_medida: string; estado?: string }[]
    | null;
  hotels: { nombre: string } | { nombre: string }[] | null;
  regions: { nombre: string } | { nombre: string }[] | null;
};

type RawTargetRow = Record<string, unknown>;

type TrafficLightRange = {
  kpi_id: string;
  cumplimiento_min_pct: number;
  riesgo_min_pct: number;
  riesgo_max_pct: number;
};

function unwrapOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export function buildTrafficLightRangeMap(
  ranges: TrafficLightRange[]
): Map<string, TrafficLightRangeInput> {
  const map = new Map<string, TrafficLightRangeInput>();
  for (const range of ranges) {
    if (!map.has(range.kpi_id)) {
      map.set(range.kpi_id, {
        cumplimiento_min_pct: range.cumplimiento_min_pct,
        riesgo_min_pct: range.riesgo_min_pct,
        riesgo_max_pct: range.riesgo_max_pct,
      });
    }
  }
  return map;
}

export function buildExecutiveDashboardRows(
  values: RawValueRow[],
  targets: RawTargetRow[],
  ranges: TrafficLightRange[]
): DashboardKpiRow[] {
  const targetsByKpi = new Map<string, RawTargetRow[]>();
  for (const target of targets) {
    const kpiId = target.kpi_id as string;
    const bucket = targetsByKpi.get(kpiId) ?? [];
    bucket.push(target);
    targetsByKpi.set(kpiId, bucket);
  }

  const rangeByKpi = buildTrafficLightRangeMap(ranges);

  return values.map((row) => {
    const kpi = unwrapOne(row.kpis);
    const hotel = unwrapOne(row.hotels);
    const region = unwrapOne(row.regions);
    const kpiTargets = mapRawTargetsForMatch(targetsByKpi.get(row.kpi_id) ?? []);
    const compliance = resolveValueCompliance(
      {
        fecha: row.fecha,
        valor_real: Number(row.valor_real),
        hotel_id: row.hotel_id,
        region_id: row.region_id,
        marketing_campaign_id: row.marketing_campaign_id,
      },
      kpiTargets,
      rangeByKpi.get(row.kpi_id)
    );

    return {
      id: row.id,
      kpi_id: row.kpi_id,
      kpi_nombre: kpi?.nombre ?? "—",
      kpi_codigo: kpi?.codigo ?? "—",
      unidad_medida: kpi?.unidad_medida ?? "",
      hotel_id: row.hotel_id,
      hotel_nombre: hotel?.nombre ?? null,
      region_id: row.region_id,
      region_nombre: region?.nombre ?? null,
      fecha: row.fecha,
      valor_real: Number(row.valor_real),
      valor_meta: compliance.valor_meta,
      cumplimiento_pct: compliance.cumplimiento_pct,
      semaforo_calculado: compliance.semaforo_calculado,
      fuente: row.fuente,
    };
  });
}

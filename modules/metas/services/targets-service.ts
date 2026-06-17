import { createClient } from "@/lib/supabase/server";
import type { KpiTargetInput } from "@/lib/validations/schemas";
import { kpiTargetSchema } from "@/lib/validations/schemas";
import type { DashboardFilters } from "@/modules/dashboard/types";
import type { MetasDashboardRow } from "../types";
import type { TrafficLightStatus } from "@/types/database";
import { isTargetExpired } from "@/lib/metas/target-status";

type TrafficLightRange = {
  kpi_id: string;
  cumplimiento_min_pct: number;
  riesgo_min_pct: number;
  riesgo_max_pct: number;
  vigencia_desde: string;
};

type KpiValueRow = {
  kpi_id: string;
  hotel_id: string | null;
  region_id: string | null;
  fecha: string;
  valor_real: number;
};

function computeSemaforo(
  cumplimientoPct: number | null,
  ranges?: Pick<
    TrafficLightRange,
    "cumplimiento_min_pct" | "riesgo_min_pct" | "riesgo_max_pct"
  >
): TrafficLightStatus | null {
  if (cumplimientoPct == null) return null;
  const minCumplimiento = ranges?.cumplimiento_min_pct ?? 100;
  const minRiesgo = ranges?.riesgo_min_pct ?? 80;
  const maxRiesgo = ranges?.riesgo_max_pct ?? 99.99;
  if (cumplimientoPct >= minCumplimiento) return "cumplimiento";
  if (cumplimientoPct >= minRiesgo && cumplimientoPct <= maxRiesgo) return "riesgo";
  return "incumplimiento";
}

function matchesTargetScope(
  target: { hotel_id: string | null; region_id: string | null },
  value: KpiValueRow
): boolean {
  if (target.hotel_id) return value.hotel_id === target.hotel_id;
  if (target.region_id) return value.region_id === target.region_id;
  return true;
}

function findLatestValueInPeriod(
  target: {
    kpi_id: string;
    hotel_id: string | null;
    region_id: string | null;
    fecha_inicio: string;
    fecha_fin: string;
  },
  values: KpiValueRow[]
): KpiValueRow | null {
  const inPeriod = values.filter(
    (v) =>
      v.kpi_id === target.kpi_id &&
      v.fecha >= target.fecha_inicio &&
      v.fecha <= target.fecha_fin &&
      matchesTargetScope(target, v)
  );
  if (inPeriod.length === 0) return null;
  return inPeriod.reduce((latest, v) => (v.fecha > latest.fecha ? v : latest));
}

export async function listTargetsForDashboard(
  filters: DashboardFilters = {}
): Promise<MetasDashboardRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("kpi_targets")
    .select(
      `
      id, kpi_id, periodo_tipo, fecha_inicio, fecha_fin, valor_meta,
      hotel_id, region_id,
      kpis(codigo, nombre, unidad_medida, estado),
      hotels(nombre),
      regions(nombre)
    `
    )
    .order("fecha_inicio", { ascending: false });

  if (filters.fechaHasta) query = query.lte("fecha_inicio", filters.fechaHasta);
  if (filters.fechaDesde) query = query.gte("fecha_fin", filters.fechaDesde);

  const { data: rawTargets, error } = await query;
  if (error) throw new Error(error.message);

  const targets = (rawTargets ?? []).filter((t) => {
    const kpiRaw = t.kpis as { estado?: string } | { estado?: string }[] | null;
    const kpi = Array.isArray(kpiRaw) ? kpiRaw[0] : kpiRaw;
    if (kpi?.estado && kpi.estado !== "activo") return false;
    if (filters.hotelId && t.hotel_id && t.hotel_id !== filters.hotelId) return false;
    if (filters.regionId && t.region_id && t.region_id !== filters.regionId) return false;
    return true;
  });

  if (targets.length === 0) return [];

  const kpiIds = [...new Set(targets.map((t) => t.kpi_id as string))];

  const [{ data: values }, { data: ranges }] = await Promise.all([
    supabase
      .from("kpi_values")
      .select("kpi_id, hotel_id, region_id, fecha, valor_real")
      .in("kpi_id", kpiIds),
    supabase
      .from("kpi_traffic_light_ranges")
      .select("kpi_id, cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct, vigencia_desde")
      .in("kpi_id", kpiIds)
      .order("vigencia_desde", { ascending: false }),
  ]);

  const rangeByKpi = new Map<string, TrafficLightRange>();
  for (const r of (ranges ?? []) as TrafficLightRange[]) {
    if (!rangeByKpi.has(r.kpi_id)) rangeByKpi.set(r.kpi_id, r);
  }

  const valueRows = (values ?? []) as KpiValueRow[];

  return targets.map((t) => {
    const kpiRaw = t.kpis as
      | { codigo: string; nombre: string; unidad_medida: string; estado?: string }
      | { codigo: string; nombre: string; unidad_medida: string; estado?: string }[]
      | null;
    const kpi = Array.isArray(kpiRaw) ? kpiRaw[0] : kpiRaw;
    if (!kpi) {
      throw new Error("KPI no encontrado para meta");
    }
    const hotelRaw = t.hotels as { nombre: string } | { nombre: string }[] | null;
    const regionRaw = t.regions as { nombre: string } | { nombre: string }[] | null;
    const hotel = Array.isArray(hotelRaw) ? hotelRaw[0] : hotelRaw;
    const region = Array.isArray(regionRaw) ? regionRaw[0] : regionRaw;
    const target = {
      kpi_id: t.kpi_id as string,
      hotel_id: t.hotel_id as string | null,
      region_id: t.region_id as string | null,
      fecha_inicio: t.fecha_inicio as string,
      fecha_fin: t.fecha_fin as string,
    };
    const latest = findLatestValueInPeriod(target, valueRows);
    const valorReal = latest?.valor_real ?? null;
    const valorMeta = Number(t.valor_meta);
    const cumplimientoPct =
      valorReal != null && valorMeta > 0
        ? Number(((valorReal / valorMeta) * 100).toFixed(2))
        : null;

    return {
      id: t.id as string,
      kpi_id: t.kpi_id as string,
      kpi_codigo: kpi.codigo,
      kpi_nombre: kpi.nombre,
      unidad_medida: kpi.unidad_medida,
      periodo_tipo: t.periodo_tipo as string,
      fecha_inicio: t.fecha_inicio as string,
      fecha_fin: t.fecha_fin as string,
      valor_meta: valorMeta,
      hotel_id: t.hotel_id as string | null,
      hotel_nombre: hotel?.nombre ?? null,
      region_id: t.region_id as string | null,
      region_nombre: region?.nombre ?? null,
      valor_real: valorReal,
      cumplimiento_pct: cumplimientoPct,
      semaforo: computeSemaforo(cumplimientoPct, rangeByKpi.get(t.kpi_id as string)),
      vencida: isTargetExpired(t.fecha_fin as string),
    };
  });
}

export async function listTargets(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_targets")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("fecha_inicio", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTarget(input: KpiTargetInput, userId: string) {
  const parsed = kpiTargetSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_targets")
    .insert({ ...parsed, created_by: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTarget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("kpi_targets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listTrafficLightRanges(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_traffic_light_ranges")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("vigencia_desde", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertTrafficLightRange(
  kpiId: string,
  ranges: {
    cumplimiento_min_pct: number;
    riesgo_min_pct: number;
    riesgo_max_pct: number;
    incumplimiento_max_pct: number;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_traffic_light_ranges")
    .upsert(
      { kpi_id: kpiId, vigencia_desde: new Date().toISOString().slice(0, 10), ...ranges },
      { onConflict: "kpi_id,vigencia_desde" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

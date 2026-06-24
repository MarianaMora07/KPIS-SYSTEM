import { createClient } from "@/lib/supabase/server";
import type { DashboardFilters, DashboardKpiRow } from "../types";
import { withCache } from "@/lib/cache/dashboard-cache";
import { buildExecutiveDashboardRows } from "./build-executive-rows";

export type { DashboardFilters } from "../types";

function cacheKey(prefix: string, filters: DashboardFilters) {
  return `${prefix}:${JSON.stringify(filters)}`;
}

async function fetchExecutiveRows(
  filters: DashboardFilters = {}
): Promise<DashboardKpiRow[]> {
  const supabase = await createClient();

  let valuesQuery = supabase
    .from("kpi_values")
    .select(
      `
      id, kpi_id, fecha, valor_real, fuente, hotel_id, region_id, marketing_campaign_id,
      kpis!inner(nombre, codigo, unidad_medida, estado),
      hotels(nombre),
      regions(nombre)
    `
    )
    .eq("kpis.estado", "activo")
    .order("fecha", { ascending: false });

  if (filters.hotelId) valuesQuery = valuesQuery.eq("hotel_id", filters.hotelId);
  if (filters.regionId) valuesQuery = valuesQuery.eq("region_id", filters.regionId);
  if (filters.fechaDesde) valuesQuery = valuesQuery.gte("fecha", filters.fechaDesde);
  if (filters.fechaHasta) valuesQuery = valuesQuery.lte("fecha", filters.fechaHasta);

  const { data: values, error } = await valuesQuery.limit(500);
  if (error) throw new Error(error.message);
  if (!values?.length) return [];

  const kpiIds = [...new Set(values.map((v) => v.kpi_id as string))];

  let targetsQuery = supabase
    .from("kpi_targets")
    .select(
      "id, kpi_id, periodo_tipo, fecha_inicio, fecha_fin, valor_meta, hotel_id, region_id, marketing_campaign_id"
    )
    .in("kpi_id", kpiIds);

  if (filters.fechaHasta) targetsQuery = targetsQuery.lte("fecha_inicio", filters.fechaHasta);
  if (filters.fechaDesde) targetsQuery = targetsQuery.gte("fecha_fin", filters.fechaDesde);
  if (filters.hotelId) {
    targetsQuery = targetsQuery.or(`hotel_id.is.null,hotel_id.eq.${filters.hotelId}`);
  }
  if (filters.regionId) {
    targetsQuery = targetsQuery.or(`region_id.is.null,region_id.eq.${filters.regionId}`);
  }

  const [{ data: targets, error: targetsError }, { data: ranges, error: rangesError }] =
    await Promise.all([
      targetsQuery,
      supabase
        .from("kpi_traffic_light_ranges")
        .select("kpi_id, cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct, vigencia_desde")
        .in("kpi_id", kpiIds)
        .order("vigencia_desde", { ascending: false }),
    ]);

  if (targetsError) throw new Error(targetsError.message);
  if (rangesError) throw new Error(rangesError.message);

  return buildExecutiveDashboardRows(values, targets ?? [], ranges ?? []);
}

export async function getDashboardKpis(
  filters: DashboardFilters = {}
): Promise<DashboardKpiRow[]> {
  return withCache(cacheKey("dashboard", filters), () => fetchExecutiveRows(filters));
}

/** Último valor por KPI (para tarjetas principales), ordenados por fecha de creación del KPI */
export async function getLatestKpiCards(filters: DashboardFilters = {}) {
  return withCache(cacheKey("cards", filters), async () => {
    const rows = await fetchExecutiveRows(filters);
    const latestByKpi = new Map<string, DashboardKpiRow>();
    for (const row of rows) {
      if (!latestByKpi.has(row.kpi_id)) {
        latestByKpi.set(row.kpi_id, row);
      }
    }
    const cards = Array.from(latestByKpi.values());

    const supabase = await createClient();
    const { data: kpis } = await supabase
      .from("kpis")
      .select("id, created_at")
      .eq("estado", "activo")
      .order("created_at", { ascending: true });

    const order = new Map((kpis ?? []).map((kpi, index) => [kpi.id, index]));
    cards.sort(
      (a, b) =>
        (order.get(a.kpi_id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.kpi_id) ?? Number.MAX_SAFE_INTEGER)
    );

    return cards;
  });
}

export async function getKpiHistory(kpiId: string, limit = 12) {
  const supabase = await createClient();
  const { data: values, error } = await supabase
    .from("kpi_values")
    .select(
      `
      id, kpi_id, fecha, valor_real, fuente, hotel_id, region_id, marketing_campaign_id,
      kpis!inner(nombre, codigo, unidad_medida, estado),
      hotels(nombre),
      regions(nombre)
    `
    )
    .eq("kpi_id", kpiId)
    .eq("kpis.estado", "activo")
    .order("fecha", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!values?.length) return [];

  const [{ data: targets }, { data: ranges }] = await Promise.all([
    supabase
      .from("kpi_targets")
      .select(
        "id, kpi_id, periodo_tipo, fecha_inicio, fecha_fin, valor_meta, hotel_id, region_id, marketing_campaign_id"
      )
      .eq("kpi_id", kpiId),
    supabase
      .from("kpi_traffic_light_ranges")
      .select("kpi_id, cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct, vigencia_desde")
      .eq("kpi_id", kpiId)
      .order("vigencia_desde", { ascending: false }),
  ]);

  return buildExecutiveDashboardRows(values, targets ?? [], ranges ?? []);
}

export async function getCriticalKpis(filters: DashboardFilters = {}) {
  const cards = await getLatestKpiCards(filters);
  return cards.filter((k) => k.semaforo_calculado === "incumplimiento");
}

/** Top hoteles/KPIs con peor desempeño (riesgo o incumplimiento) */
export async function getWorstPerformers(
  filters: DashboardFilters = {},
  limit = 3
) {
  const rows = await fetchExecutiveRows(filters);
  const latest = new Map<string, DashboardKpiRow>();
  for (const row of rows) {
    const key = `${row.hotel_id ?? row.hotel_nombre}-${row.kpi_id}`;
    const existing = latest.get(key);
    if (!existing || row.fecha > existing.fecha) latest.set(key, row);
  }
  return Array.from(latest.values())
    .filter(
      (k) =>
        k.semaforo_calculado === "incumplimiento" || k.semaforo_calculado === "riesgo"
    )
    .sort((a, b) => (a.cumplimiento_pct ?? 0) - (b.cumplimiento_pct ?? 0))
    .slice(0, limit);
}

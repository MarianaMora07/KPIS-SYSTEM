import { createClient } from "@/lib/supabase/server";
import type { DashboardFilters, DashboardKpiRow } from "../types";
import { withCache } from "@/lib/cache/dashboard-cache";

export type { DashboardFilters } from "../types";

function cacheKey(prefix: string, filters: DashboardFilters) {
  return `${prefix}:${JSON.stringify(filters)}`;
}

export async function getDashboardKpis(
  filters: DashboardFilters = {}
): Promise<DashboardKpiRow[]> {
  return withCache(cacheKey("dashboard", filters), async () => {
    const supabase = await createClient();

    let query = supabase
      .from("v_dashboard_kpis")
      .select("*")
      .order("fecha", { ascending: false });

    if (filters.hotelId) query = query.eq("hotel_id", filters.hotelId);
    if (filters.regionId) query = query.eq("region_id", filters.regionId);
    if (filters.fechaDesde) query = query.gte("fecha", filters.fechaDesde);
    if (filters.fechaHasta) query = query.lte("fecha", filters.fechaHasta);

    const { data, error } = await query.limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as DashboardKpiRow[];
  });
}

/** Último valor por KPI (para tarjetas principales) */
export async function getLatestKpiCards(filters: DashboardFilters = {}) {
  return withCache(cacheKey("cards", filters), async () => {
    const rows = await getDashboardKpis(filters);
    const latestByKpi = new Map<string, DashboardKpiRow>();
    for (const row of rows) {
      if (!latestByKpi.has(row.kpi_id)) {
        latestByKpi.set(row.kpi_id, row);
      }
    }
    return Array.from(latestByKpi.values());
  });
}

export async function getKpiHistory(kpiId: string, limit = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_dashboard_kpis")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("fecha", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardKpiRow[];
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
  const rows = await getDashboardKpis(filters);
  const latest = new Map<string, DashboardKpiRow>();
  for (const row of rows) {
    const key = `${row.hotel_id ?? row.hotel_nombre}-${row.kpi_id}`;
    const existing = latest.get(key);
    if (!existing || row.fecha > existing.fecha) latest.set(key, row);
  }
  return Array.from(latest.values())
    .filter(
      (k) =>
        k.semaforo_calculado === "incumplimiento" ||
        k.semaforo_calculado === "riesgo"
    )
    .sort((a, b) => (a.cumplimiento_pct ?? 0) - (b.cumplimiento_pct ?? 0))
    .slice(0, limit);
}

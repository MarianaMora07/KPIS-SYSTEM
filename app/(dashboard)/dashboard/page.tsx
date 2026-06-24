import {
  getLatestKpiCards,
  getDashboardKpis,
  getWorstPerformers,
} from "@/modules/dashboard/services/dashboard-service";
import { DashboardTabsView } from "@/modules/dashboard/components/dashboard-tabs-view";
import { parseDashboardTab } from "@/modules/dashboard/dashboard-tab";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  DEMO_DASHBOARD_DATA,
  DEMO_METAS_DATA,
  DEMO_KPI_CREATION_ORDER,
  filterDemoData,
  filterDemoMetas,
} from "@/modules/dashboard/data/demo-data";
import { getWorstPerformers as getWorstFromCards } from "@/modules/dashboard/utils/chart-data";
import { listTargetsForDashboard } from "@/modules/metas/services/targets-service";
import { syncAllAlerts } from "@/modules/alertas/services/alert-sync-service";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import type { MetasDashboardRow } from "@/modules/metas/types";
import { Suspense } from "react";

interface PageProps {
  searchParams: Promise<{
    region?: string;
    hotel?: string;
    desde?: string;
    hasta?: string;
    tab?: string;
  }>;
}

async function DashboardData({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    regionId: params.region,
    hotelId: params.hotel,
    fechaDesde: params.desde ?? "2026-06-01",
    fechaHasta: params.hasta ?? "2026-06-30",
  };
  const initialTab = parseDashboardTab(params.tab);

  let kpiCards: DashboardKpiRow[] = [];
  let history: DashboardKpiRow[] = [];
  let worstPerformers: DashboardKpiRow[] = [];
  let metas: MetasDashboardRow[] = [];
  let isDemo = false;

  if (isSupabaseConfigured()) {
    try {
      await syncAllAlerts().catch(() => {});
      const results = await Promise.allSettled([
        getLatestKpiCards(filters),
        getDashboardKpis(filters),
        getWorstPerformers(filters),
        listTargetsForDashboard(filters),
      ]);

      const failed = results.some((r) => r.status === "rejected");
      if (results[0].status === "fulfilled") kpiCards = results[0].value;
      if (results[1].status === "fulfilled") history = results[1].value;
      if (results[2].status === "fulfilled") worstPerformers = results[2].value;
      if (results[3].status === "fulfilled") metas = results[3].value;

      if (failed || kpiCards.length === 0) {
        const demoFilters = {
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
        };
        if (kpiCards.length === 0) {
          isDemo = true;
          const demo = filterDemoData(DEMO_DASHBOARD_DATA, demoFilters);
          kpiCards = getLatestFromDemo(demo);
          history = demo;
          worstPerformers = getWorstFromCards(demo);
        }
        if (metas.length === 0 && results[3].status === "rejected") {
          metas = filterDemoMetas(DEMO_METAS_DATA, demoFilters);
        }
      }
    } catch {
      isDemo = true;
      const demoFilters = {
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
      };
      const demo = filterDemoData(DEMO_DASHBOARD_DATA, demoFilters);
      kpiCards = getLatestFromDemo(demo);
      history = demo;
      worstPerformers = getWorstFromCards(demo);
      metas = filterDemoMetas(DEMO_METAS_DATA, demoFilters);
    }
  } else {
    isDemo = true;
    const demo = filterDemoData(DEMO_DASHBOARD_DATA, filters);
    kpiCards = getLatestFromDemo(demo);
    history = demo;
    worstPerformers = getWorstFromCards(demo);
    metas = filterDemoMetas(DEMO_METAS_DATA, filters);
  }

  return (
    <DashboardTabsView
      kpiCards={kpiCards}
      worstPerformers={worstPerformers}
      history={history}
      metas={metas}
      isDemo={isDemo}
      initialTab={initialTab}
    />
  );
}

function getLatestFromDemo(data: DashboardKpiRow[]) {
  const map = new Map<string, DashboardKpiRow>();
  for (const row of data) {
    const existing = map.get(row.kpi_id);
    if (!existing || row.fecha > existing.fecha) {
      map.set(row.kpi_id, row);
    }
  }
  const cards = Array.from(map.values());
  const order = new Map(DEMO_KPI_CREATION_ORDER.map((id, index) => [id, index]));
  cards.sort(
    (a, b) =>
      (order.get(a.kpi_id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.kpi_id) ?? Number.MAX_SAFE_INTEGER)
  );
  return cards;
}

export default function ExecutiveDashboardPage(props: PageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData searchParams={props.searchParams} />
    </Suspense>
  );
}

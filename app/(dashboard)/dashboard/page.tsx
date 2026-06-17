import {
  getLatestKpiCards,
  getDashboardKpis,
  getWorstPerformers,
} from "@/modules/dashboard/services/dashboard-service";
import {
  DashboardTabsView,
  type DashboardTab,
} from "@/modules/dashboard/components/dashboard-tabs-view";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  DEMO_DASHBOARD_DATA,
  DEMO_METAS_DATA,
  filterDemoData,
  filterDemoMetas,
} from "@/modules/dashboard/data/demo-data";
import { getWorstPerformers as getWorstFromCards } from "@/modules/dashboard/utils/chart-data";
import { listTargetsForDashboard } from "@/modules/metas/services/targets-service";
import { syncExpiredTargetAlerts } from "@/modules/metas/services/target-expiry-service";
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
  const initialTab: DashboardTab = params.tab === "metas" ? "metas" : "ejecutivo";

  let kpiCards: DashboardKpiRow[] = [];
  let history: DashboardKpiRow[] = [];
  let worstPerformers: DashboardKpiRow[] = [];
  let metas: MetasDashboardRow[] = [];
  let isDemo = false;

  if (isSupabaseConfigured()) {
    try {
      await syncExpiredTargetAlerts().catch(() => {});
      [kpiCards, history, worstPerformers, metas] = await Promise.all([
        getLatestKpiCards(filters),
        getDashboardKpis(filters),
        getWorstPerformers(filters),
        listTargetsForDashboard(filters),
      ]);
    } catch {
      isDemo = true;
      const demo = filterDemoData(DEMO_DASHBOARD_DATA, filters);
      kpiCards = getLatestFromDemo(demo);
      history = demo;
      worstPerformers = getWorstFromCards(demo);
      metas = filterDemoMetas(DEMO_METAS_DATA, filters);
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
  return Array.from(map.values());
}

export default function ExecutiveDashboardPage(props: PageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData searchParams={props.searchParams} />
    </Suspense>
  );
}

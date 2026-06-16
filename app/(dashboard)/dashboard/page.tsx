import {
  getLatestKpiCards,
  getDashboardKpis,
  getWorstPerformers,
} from "@/modules/dashboard/services/dashboard-service";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  DEMO_DASHBOARD_DATA,
  filterDemoData,
} from "@/modules/dashboard/data/demo-data";
import { getWorstPerformers as getWorstFromCards } from "@/modules/dashboard/utils/chart-data";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import { Suspense } from "react";

interface PageProps {
  searchParams: Promise<{
    region?: string;
    hotel?: string;
    desde?: string;
    hasta?: string;
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

  let kpiCards: DashboardKpiRow[] = [];
  let history: DashboardKpiRow[] = [];
  let worstPerformers: DashboardKpiRow[] = [];
  let isDemo = false;

  if (isSupabaseConfigured()) {
    try {
      [kpiCards, history, worstPerformers] = await Promise.all([
        getLatestKpiCards(filters),
        getDashboardKpis(filters),
        getWorstPerformers(filters),
      ]);
    } catch {
      isDemo = true;
      const demo = filterDemoData(DEMO_DASHBOARD_DATA, filters);
      kpiCards = getLatestFromDemo(demo);
      history = demo;
      worstPerformers = getWorstFromCards(demo);
    }
  } else {
    isDemo = true;
    const demo = filterDemoData(DEMO_DASHBOARD_DATA, filters);
    kpiCards = getLatestFromDemo(demo);
    history = demo;
    worstPerformers = getWorstFromCards(demo);
  }

  return (
    <DashboardView
      kpiCards={kpiCards}
      worstPerformers={worstPerformers}
      history={history}
      isDemo={isDemo}
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

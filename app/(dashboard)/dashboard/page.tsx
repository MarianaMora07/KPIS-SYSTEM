import {
  getLatestKpiCards,
  getDashboardKpis,
  getCriticalKpis,
} from "@/modules/dashboard/services/dashboard-service";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { DEMO_DASHBOARD_DATA } from "@/modules/dashboard/data/demo-data";
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
  let criticalKpis: DashboardKpiRow[] = [];
  let isDemo = false;

  if (isSupabaseConfigured()) {
    try {
      [kpiCards, history, criticalKpis] = await Promise.all([
        getLatestKpiCards(filters),
        getDashboardKpis(filters),
        getCriticalKpis(filters),
      ]);
    } catch {
      isDemo = true;
      kpiCards = getLatestFromDemo(DEMO_DASHBOARD_DATA);
      history = DEMO_DASHBOARD_DATA;
      criticalKpis = kpiCards.filter(
        (k) => k.semaforo_calculado === "incumplimiento"
      );
    }
  } else {
    isDemo = true;
    kpiCards = getLatestFromDemo(DEMO_DASHBOARD_DATA);
    history = DEMO_DASHBOARD_DATA;
    criticalKpis = kpiCards.filter(
      (k) => k.semaforo_calculado === "incumplimiento"
    );
  }

  return (
    <DashboardView
      kpiCards={kpiCards}
      criticalKpis={criticalKpis}
      history={history}
      isDemo={isDemo}
    />
  );
}

function getLatestFromDemo(data: DashboardKpiRow[]) {
  const map = new Map<string, DashboardKpiRow>();
  for (const row of data) {
    if (!map.has(row.kpi_id)) map.set(row.kpi_id, row);
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

import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  listOpenAlerts,
  listActionPlans,
  type AlertListFilters,
} from "@/modules/alertas/services/alert-service";
import { filterAlertsClient } from "@/modules/alertas/utils/filter-alerts";
import { listUsers } from "@/modules/seguridad/services/security-service";
import { DEMO_ALERTS } from "@/modules/alertas/data/demo-alerts";
import { AlertasTabsView } from "@/modules/alertas/components/alertas-tabs-view";
import { Suspense } from "react";

interface AlertasPageProps {
  searchParams: Promise<{
    accion?: string;
    kpi_id?: string;
    kpi?: string;
    alert_id?: string;
    hotel_id?: string;
    hotel?: string;
    tab?: string;
    region?: string;
    desde?: string;
    hasta?: string;
  }>;
}

export default async function AlertasPage({ searchParams }: AlertasPageProps) {
  const params = await searchParams;
  const isDemo = !isSupabaseConfigured();

  const alertFilters: AlertListFilters = {
    regionId: params.region,
    hotelId: params.hotel,
    fechaDesde: params.desde,
    fechaHasta: params.hasta,
  };

  if (!isDemo) {
    await requirePermission("alertas.ver");
  }

  let alerts: typeof DEMO_ALERTS = isDemo
    ? filterAlertsClient(DEMO_ALERTS, alertFilters)
    : [];
  let plans: Awaited<ReturnType<typeof listActionPlans>> = [];
  let users: { id: string; nombre: string }[] = [];

  if (!isDemo) {
    try {
      const [alertsData, plansData, usersData] = await Promise.all([
        listOpenAlerts(alertFilters),
        listActionPlans(),
        listUsers(),
      ]);
      alerts = alertsData;
      plans = plansData;
      users = usersData.map((u) => ({
        id: u.id,
        nombre: [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email,
      }));
    } catch {
      alerts = DEMO_ALERTS;
    }
  }

  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
      <AlertasTabsView
        alerts={alerts}
        plans={plans}
        users={users}
        isDemo={isDemo}
        planFormParams={
          params.accion === "plan" && params.kpi_id && params.kpi
            ? {
                kpiId: params.kpi_id,
                kpiNombre: params.kpi,
                hotelNombre: params.hotel,
                alertId: params.alert_id,
              }
            : null
        }
        initialTab={params.tab === "planes" ? "planes" : "alertas"}
      />
    </Suspense>
  );
}

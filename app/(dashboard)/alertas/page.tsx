import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { listAlerts, listActionPlans } from "@/modules/alertas/services/alert-service";
import { listUsers } from "@/modules/seguridad/services/security-service";
import { DEMO_ALERTS } from "@/modules/alertas/data/demo-alerts";
import { AlertasTabsView } from "@/modules/alertas/components/alertas-tabs-view";

interface AlertasPageProps {
  searchParams: Promise<{
    accion?: string;
    kpi_id?: string;
    kpi?: string;
    alert_id?: string;
    hotel_id?: string;
    hotel?: string;
    tab?: string;
  }>;
}

export default async function AlertasPage({ searchParams }: AlertasPageProps) {
  const params = await searchParams;
  const isDemo = !isSupabaseConfigured();

  let alerts = DEMO_ALERTS;
  let plans: Awaited<ReturnType<typeof listActionPlans>> = [];
  let users: { id: string; nombre: string }[] = [];

  if (!isDemo) {
    try {
      const [alertsData, plansData, usersData] = await Promise.all([
        listAlerts("activa"),
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
  );
}

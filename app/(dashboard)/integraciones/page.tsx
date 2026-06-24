import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requirePermission } from "@/lib/auth/require-permission";
import { listIntegrations } from "@/modules/integraciones/services/integration-service";
import { listDatabaseConnections } from "@/modules/sql-data-sources/services/connection-service";
import { IntegracionesView } from "@/modules/integraciones/components/integraciones-view";

const DEMO_INTEGRATIONS = [
  {
    id: "e5000000-0000-4000-8000-000000000001",
    nombre: "PMS Estelar Demo",
    sistema_tipo: "pms",
    endpoint_url: "https://api.demo-pms.estelar.local/sync",
    activa: true,
    frecuencia_cron: "0 6 * * *",
  },
];

export default async function IntegracionesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Integraciones con PMS, CRM, ERP y fuentes externas (modo demo).
        </p>
        <IntegracionesView integrations={DEMO_INTEGRATIONS} />
      </div>
    );
  }

  await requirePermission("integraciones.gestionar");

  let integrations = DEMO_INTEGRATIONS;
  let databaseConnections: Awaited<ReturnType<typeof listDatabaseConnections>> = [];
  try {
    [integrations, databaseConnections] = await Promise.all([
      listIntegrations(),
      listDatabaseConnections(),
    ]);
  } catch {
    integrations = DEMO_INTEGRATIONS;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Integraciones con PMS, CRM, ERP, bases de datos SQL y fuentes externas. Los jobs se ejecutan
        en segundo plano con reintentos y notificación vía Activepieces en caso de fallo
        (HU-KPI-005). Ver <code className="text-xs">docs/activepieces-workflows.md</code>.
      </p>
      <IntegracionesView
        integrations={integrations}
        databaseConnections={databaseConnections}
      />
    </div>
  );
}

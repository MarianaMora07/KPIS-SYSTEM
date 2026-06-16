import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { listIntegrations } from "@/modules/integraciones/services/integration-service";
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
  let integrations = DEMO_INTEGRATIONS;

  if (isSupabaseConfigured()) {
    try {
      integrations = await listIntegrations();
    } catch {
      integrations = DEMO_INTEGRATIONS;
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Integraciones con PMS, CRM, ERP y fuentes externas. Los jobs se ejecutan
        en segundo plano con reintentos y notificación vía Activepieces en caso de fallo
        (HU-KPI-005). Ver <code className="text-xs">docs/activepieces-workflows.md</code>.
      </p>
      <IntegracionesView integrations={integrations} />
    </div>
  );
}

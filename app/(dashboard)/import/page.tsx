import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { listImportJobs } from "@/modules/import/services/import-service";
import { ImportUploadView } from "@/modules/import/components/import-upload-view";
import { ImportHistoryList } from "@/modules/import/components/import-history-list";

export default async function ImportPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-sm text-amber-800">
          Configure Supabase en <code>.env.local</code> e inicie sesión para
          importar archivos Excel o CSV.
        </p>
      </div>
    );
  }

  await requirePermission("import.cargar");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const history = user ? await listImportJobs(user.id).catch(() => []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/import/template"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Descargar plantilla Excel
        </a>
      </div>
      <p className="text-sm text-slate-600">
        Carga masiva de <strong>valores KPI</strong> (<code>kpi_values</code>) para KPIs ya
        existentes. Use <code>valor_real</code> para KPIs sin fórmula, o columnas{" "}
        <code>var_&#123;codigo&#125;</code> cuando el KPI tenga fórmula configurada (ej.{" "}
        <code>var_visitas_mes</code>, <code>var_reservas_web</code>). La definición de variables y
        fórmulas se gestiona en el detalle de cada KPI (solo administrador).
      </p>
      <ImportUploadView />

      <ImportHistoryList jobs={history} />
    </div>
  );
}

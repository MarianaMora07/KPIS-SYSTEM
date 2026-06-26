import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { listImportJobs } from "@/modules/import/services/import-service";
import { ImportUploadView } from "@/modules/import/components/import-upload-view";
import { ImportGuideCard } from "@/modules/import/components/import-guide-card";
import { ImportHistoryList } from "@/modules/import/components/import-history-list";
import { listKpis } from "@/modules/kpis/services/kpi-service";

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
  const kpis = await listKpis().catch(() => []);

  const { data: variablesData } = await supabase
    .from("kpi_variables")
    .select("codigo, nombre")
    .order("codigo");
  const variables = variablesData ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/import/template"
          className="inline-flex items-center gap-2 rounded-lg border border-imperial-900/15 bg-white px-4 py-2 text-sm font-medium text-imperial-900 shadow-sm transition-colors hover:bg-slate-50"
        >
          Descargar plantilla Excel
        </a>
      </div>
      <ImportGuideCard />
      <ImportUploadView kpis={kpis} variables={variables} />

      <ImportHistoryList jobs={history} />
    </div>
  );
}


import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { listImportJobs } from "@/modules/import/services/import-service";
import { ImportUploadView } from "@/modules/import/components/import-upload-view";

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
        existentes. No crea ni modifica la definición del indicador; use el formulario en{" "}
        <a href="/kpis" className="text-amber-700 underline">
          KPIs
        </a>{" "}
        para altas individuales.
      </p>
      <ImportUploadView />

      {history.length > 0 && (
        <section className="glass rounded-xl border border-slate-200/60 p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
            Historial de importaciones
          </h2>
          <ul className="space-y-2 text-sm">
            {history.map((job) => (
              <li
                key={job.id}
                className="flex justify-between rounded bg-slate-50 px-3 py-2"
              >
                <span>{job.nombre_archivo}</span>
                <span className="text-slate-500">
                  {job.estado} · {job.filas_ok ?? 0}/{job.total_filas ?? 0} ok
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(job.created_at).toLocaleString("es-CO")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

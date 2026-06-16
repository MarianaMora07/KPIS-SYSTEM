import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { ReportesView } from "@/modules/reportes/components/reportes-view";

export default function ReportesPage() {
  const isDemo = !isSupabaseConfigured();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Exportación ejecutiva en PDF, Excel y PowerPoint. Use los filtros del
        encabezado y programe envíos semanales vía cron + Activepieces.
      </p>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <ReportesView isDemo={isDemo} />
      </Suspense>
    </div>
  );
}

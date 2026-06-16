import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createClient } from "@/lib/supabase/server";
import { ReportesView } from "@/modules/reportes/components/reportes-view";
import { listScheduledReports } from "@/modules/reportes/services/scheduled-reports-service";

export default async function ReportesPage() {
  const isDemo = !isSupabaseConfigured();
  let schedules: Awaited<ReturnType<typeof listScheduledReports>> = [];

  if (!isDemo) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      schedules = await listScheduledReports(user.id).catch(() => []);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Exportación ejecutiva en PDF, Excel y PowerPoint. Use los filtros del
        encabezado y programe envíos semanales desde el panel inferior.
      </p>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <ReportesView isDemo={isDemo} schedules={schedules} />
      </Suspense>
    </div>
  );
}

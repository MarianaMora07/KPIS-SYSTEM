import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createClient } from "@/lib/supabase/server";
import { ReportesView } from "@/modules/reportes/components/reportes-view";
import { listScheduledReports } from "@/modules/reportes/services/scheduled-reports-service";
import { listRegions, listHotels } from "@/modules/catalog";
import { DEMO_REGIONS, DEMO_HOTELS } from "@/modules/dashboard/data/demo-data";

export default async function ReportesPage() {
  const isDemo = !isSupabaseConfigured();
  let schedules: Awaited<ReturnType<typeof listScheduledReports>> = [];
  let regions = DEMO_REGIONS;
  let hotels = DEMO_HOTELS;

  if (!isDemo) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      schedules = await listScheduledReports(user.id).catch(() => []);
    }
    try {
      const [r, h] = await Promise.all([listRegions(), listHotels()]);
      regions = r;
      hotels = h;
    } catch {
      // Mantener catálogo demo como respaldo
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Exportación ejecutiva en PDF, Excel y PowerPoint. Use los filtros del
        encabezado y programe envíos semanales desde el panel inferior.
      </p>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <ReportesView
          isDemo={isDemo}
          schedules={schedules}
          regions={regions.map((r) => ({ id: r.id, nombre: r.nombre }))}
          hotels={hotels.map((h) => ({ id: h.id, nombre: h.nombre }))}
        />
      </Suspense>
    </div>
  );
}

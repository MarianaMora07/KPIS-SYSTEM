import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { getDashboardKpis } from "@/modules/dashboard/services/dashboard-service";
import { exportToPdf } from "@/modules/dashboard/utils/export-report";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: schedules, error } = await supabase
    .from("scheduled_reports")
    .select("*")
    .eq("activo", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const processed = [];

  for (const schedule of schedules ?? []) {
    const filters = (schedule.filtros ?? {}) as {
      regionId?: string;
      hotelId?: string;
      fechaDesde?: string;
      fechaHasta?: string;
    };

    const rows = await getDashboardKpis(filters);

    await dispatchActivepiecesEvent("report.scheduled", {
      scheduleId: schedule.id,
      nombre: schedule.nombre,
      formato: schedule.formato,
      emails: schedule.emails,
      rowCount: rows.length,
    });

    await supabase
      .from("scheduled_reports")
      .update({ ultima_ejecucion: new Date().toISOString() })
      .eq("id", schedule.id);

    processed.push({ id: schedule.id, rows: rows.length });
  }

  return NextResponse.json({ processed: processed.length, schedules: processed });
}

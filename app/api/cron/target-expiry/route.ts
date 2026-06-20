import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { syncAllAlerts } from "@/modules/alertas/services/alert-sync-service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  try {
    const result = await syncAllAlerts();
    return NextResponse.json({
      created: result.expiredTargets + result.kpiValues,
      expiredTargets: result.expiredTargets,
      kpiValues: result.kpiValues,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar alertas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

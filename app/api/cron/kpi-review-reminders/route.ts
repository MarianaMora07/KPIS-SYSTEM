import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { dispatchKpiReviewReminders } from "@/modules/kpis/services/kpi-review-reminder-service";

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
    const result = await dispatchKpiReviewReminders();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en recordatorios KPI" },
      { status: 500 }
    );
  }
}

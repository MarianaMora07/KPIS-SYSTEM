import { NextResponse } from "next/server";
import { listAlerts } from "@/modules/alertas/services/alert-service";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { DEMO_ALERTS } from "@/modules/alertas/data/demo-alerts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") as "activa" | "escalada" | "resuelta" | null;

  if (!isSupabaseConfigured()) {
    const filtered = estado
      ? DEMO_ALERTS.filter((a) => a.estado === estado)
      : DEMO_ALERTS;
    return NextResponse.json(filtered);
  }

  try {
    const alerts = await listAlerts(estado ?? undefined);
    return NextResponse.json(alerts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

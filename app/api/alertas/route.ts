import { NextResponse } from "next/server";
import { listAlerts, listOpenAlerts } from "@/modules/alertas/services/alert-service";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { DEMO_ALERTS } from "@/modules/alertas/data/demo-alerts";
import type { AlertStatus } from "@/modules/alertas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const abiertas = searchParams.get("abiertas") === "1";
  const estado = searchParams.get("estado") as AlertStatus | null;

  if (!isSupabaseConfigured()) {
    const filtered = abiertas
      ? DEMO_ALERTS.filter((a) => a.estado === "activa" || a.estado === "escalada")
      : estado
        ? DEMO_ALERTS.filter((a) => a.estado === estado)
        : DEMO_ALERTS;
    return NextResponse.json(filtered);
  }

  try {
    const alerts = abiertas
      ? await listOpenAlerts()
      : await listAlerts(estado ?? undefined);
    return NextResponse.json(alerts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

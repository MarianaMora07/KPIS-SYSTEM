import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { syncExpiredTargetAlerts } from "@/modules/metas/services/target-expiry-service";

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
    const created = await syncExpiredTargetAlerts();
    return NextResponse.json({ created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar metas vencidas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

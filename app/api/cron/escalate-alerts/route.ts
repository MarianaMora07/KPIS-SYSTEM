import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("fn_escalate_stale_alerts");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count && count > 0) {
    await dispatchActivepiecesEvent("kpi.alert.escalated", {
      autoEscalated: true,
      count,
    });
  }

  return NextResponse.json({ escalated: count ?? 0 });
}

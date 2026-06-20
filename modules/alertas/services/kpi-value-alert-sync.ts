import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";

/** Crea alertas para el último valor KPI en riesgo/incumplimiento (idempotente). */
export async function syncKpiValueAlerts(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("fn_sync_kpi_value_alerts");

  if (error) {
    console.error("[syncKpiValueAlerts]", error.message);
    if (error.message.includes("fn_sync_kpi_value_alerts")) return 0;
    throw new Error(error.message);
  }

  const created = typeof count === "number" ? count : 0;
  if (created > 0) {
    await dispatchActivepiecesEvent("kpi.alert.created", {
      type: "kpi_valor_critico",
      count: created,
    }).catch(() => {});
  }

  return created;
}

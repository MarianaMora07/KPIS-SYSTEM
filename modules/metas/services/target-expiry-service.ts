import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";

/** Crea alertas para metas cuyo periodo ya finalizó (idempotente). */
export async function syncExpiredTargetAlerts(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("fn_sync_expired_target_alerts");

  if (error) {
    if (error.message.includes("fn_sync_expired_target_alerts")) return 0;
    throw new Error(error.message);
  }

  const created = typeof count === "number" ? count : 0;
  if (created > 0) {
    await dispatchActivepiecesEvent("kpi.alert.created", {
      type: "meta_finalizada",
      count: created,
    }).catch(() => {});
  }

  return created;
}

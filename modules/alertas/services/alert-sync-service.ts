import { syncExpiredTargetAlerts } from "@/modules/metas/services/target-expiry-service";
import { syncKpiValueAlerts } from "./kpi-value-alert-sync";

export interface AlertSyncResult {
  expiredTargets: number;
  kpiValues: number;
}

/** Sincroniza alertas de metas vencidas y valores KPI críticos. */
export async function syncAllAlerts(): Promise<AlertSyncResult> {
  const [expiredTargets, kpiValues] = await Promise.all([
    syncExpiredTargetAlerts().catch(() => 0),
    syncKpiValueAlerts().catch(() => 0),
  ]);

  return { expiredTargets, kpiValues };
}

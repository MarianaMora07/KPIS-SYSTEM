"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/require-permission";
import { invalidateCache } from "@/lib/cache/dashboard-cache";
import { registerKpiValueAction } from "@/modules/kpis/actions/kpi-actions";
import {
  createTarget,
  deleteTarget,
  upsertTrafficLightRange,
} from "../services/targets-service";
import type { KpiTargetInput } from "@/lib/validations/schemas";
import { listTargets } from "../services/targets-service";
import {
  splitTargetsByValueMatch,
  type TargetRowForMatch,
  type ValueScopeForMatch,
} from "@/lib/metas/match-value-to-targets";
import { mapRawTargetsForMatch } from "@/lib/metas/resolve-value-compliance";

export async function previewValueTargetMatchesAction(
  kpiId: string,
  value: ValueScopeForMatch
): Promise<{ matches: TargetRowForMatch[]; nonMatches: TargetRowForMatch[] }> {
  await assertPermission("metas.configurar");

  const raw = await listTargets(kpiId);
  const targets = mapRawTargetsForMatch(raw);

  return splitTargetsByValueMatch(targets, value);
}

export async function createTargetAction(kpiId: string, input: KpiTargetInput) {
  await assertPermission("metas.configurar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { valor_avance, ...targetInput } = input;
  await createTarget({ ...targetInput, kpi_id: kpiId }, user.id);

  if (valor_avance != null && !Number.isNaN(valor_avance)) {
    await registerKpiValueAction({
      kpi_id: kpiId,
      fecha: targetInput.fecha_inicio,
      valor_real: valor_avance,
      hotel_id: targetInput.hotel_id ?? null,
      region_id: targetInput.region_id ?? null,
      marketing_campaign_id: targetInput.marketing_campaign_id ?? null,
    });
  }

  invalidateCache("dashboard");
  invalidateCache("cards");
  revalidatePath("/dashboard");
  revalidatePath(`/kpis/${kpiId}`);
}

export async function deleteTargetAction(kpiId: string, targetId: string) {
  await assertPermission("metas.configurar");
  await deleteTarget(targetId);
  revalidatePath(`/kpis/${kpiId}`);
}

export async function saveTrafficLightAction(
  kpiId: string,
  ranges: {
    cumplimiento_min_pct: number;
    riesgo_min_pct: number;
    riesgo_max_pct: number;
    incumplimiento_max_pct: number;
  }
) {
  await assertPermission("metas.configurar");
  await upsertTrafficLightRange(kpiId, ranges);
  revalidatePath(`/kpis/${kpiId}`);
}

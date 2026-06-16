"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createTarget,
  deleteTarget,
  upsertTrafficLightRange,
} from "../services/targets-service";
import type { KpiTargetInput } from "@/lib/validations/schemas";

export async function createTargetAction(kpiId: string, input: KpiTargetInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  await createTarget({ ...input, kpi_id: kpiId }, user.id);
  revalidatePath(`/kpis/${kpiId}`);
}

export async function deleteTargetAction(kpiId: string, targetId: string) {
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
  await upsertTrafficLightRange(kpiId, ranges);
  revalidatePath(`/kpis/${kpiId}`);
}

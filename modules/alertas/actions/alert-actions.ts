"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/require-permission";
import { actionPlanSchema, type ActionPlanInput } from "@/lib/validations/schemas";

export async function createActionPlanAction(input: ActionPlanInput) {
  await assertPermission("planes.gestionar");
  const parsed = actionPlanSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: plan, error } = await supabase
    .from("action_plans")
    .insert({
      kpi_id: parsed.kpi_id,
      alert_id: parsed.alert_id ?? null,
      titulo: parsed.titulo,
      descripcion: parsed.descripcion ?? null,
      fecha_compromiso: parsed.fecha_compromiso,
      responsable_id: parsed.responsable_id ?? user.id,
      created_by: user.id,
      estado: "abierto",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (parsed.items?.length) {
    const items = parsed.items.map((item) => ({
      action_plan_id: plan.id,
      descripcion: item.descripcion,
      fecha_compromiso: item.fecha_compromiso ?? null,
    }));
    const { error: itemsError } = await supabase
      .from("action_plan_items")
      .insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }

  if (parsed.alert_id) {
    await supabase
      .from("alerts")
      .update({ estado: "resuelta", resuelta_at: new Date().toISOString() })
      .eq("id", parsed.alert_id);
  }

  revalidatePath("/alertas");
  revalidatePath("/dashboard");
  return plan;
}

export async function resolveAlertAction(alertId: string) {
  await assertPermission("alertas.ver");
  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({ estado: "resuelta", resuelta_at: new Date().toISOString() })
    .eq("id", alertId);

  if (error) throw new Error(error.message);
  revalidatePath("/alertas");
}

export async function escalateAlertAction(alertId: string) {
  await assertPermission("alertas.ver");
  const { escalateAlert } = await import("../services/alert-service");
  await escalateAlert(alertId);
  revalidatePath("/alertas");
}

export async function updatePlanStatusAction(planId: string, estado: string) {
  await assertPermission("planes.gestionar");
  const { updatePlanStatus } = await import("../services/alert-service");
  await updatePlanStatus(planId, estado);
  revalidatePath("/alertas");
}

export async function togglePlanItemAction(itemId: string, completado: boolean) {
  await assertPermission("planes.gestionar");
  const { togglePlanItem } = await import("../services/alert-service");
  await togglePlanItem(itemId, completado);
  revalidatePath("/alertas");
}

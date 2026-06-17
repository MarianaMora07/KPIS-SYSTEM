"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/require-permission";
import {
  kpiCreateSchema,
  kpiValueSchema,
  type KpiCreateInput,
  type KpiValueInput,
} from "@/lib/validations/schemas";
import { formatZodError } from "@/lib/validations/format-zod-error";
import { computeKpiValueFromInputs } from "@/lib/kpis/compute-formula-value";
import { invalidateCache } from "@/lib/cache/dashboard-cache";

export async function createKpiAction(input: KpiCreateInput) {
  await assertPermission("kpis.crear");
  let parsed: KpiCreateInput;
  try {
    parsed = kpiCreateSchema.parse(input);
  } catch (e) {
    throw new Error(formatZodError(e));
  }
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { estado: _e, ...rest } = parsed;

  const { data, error } = await supabase
    .from("kpis")
    .insert({ ...rest, estado: "activo", created_by: user.id, updated_by: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/kpis");
  revalidatePath("/dashboard");
  return data;
}

export async function inactivateKpiAction(id: string) {
  await assertPermission("kpis.inactivar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("kpis")
    .update({ estado: "inactivo", updated_by: user.id })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/kpis");
  revalidatePath("/dashboard");
}

export async function updateKpiAction(id: string, input: KpiCreateInput) {
  await assertPermission("kpis.editar");
  let parsed: KpiCreateInput;
  try {
    parsed = kpiCreateSchema.parse(input);
  } catch (e) {
    throw new Error(formatZodError(e));
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { updateKpi } = await import("../services/kpi-service");
  await updateKpi(id, parsed, user.id);
  revalidatePath("/kpis");
  revalidatePath(`/kpis/${id}`);
  revalidatePath("/dashboard");
}

export async function duplicateKpiAction(id: string) {
  await assertPermission("kpis.crear");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { duplicateKpi } = await import("../services/kpi-service");
  const copy = await duplicateKpi(id, user.id);
  revalidatePath("/kpis");
  return copy;
}

export async function registerKpiValueAction(input: KpiValueInput) {
  await assertPermission("metas.configurar");
  const parsed = kpiValueSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: kpi } = await supabase
    .from("kpis")
    .select("hotel_id, region_id, meta, formula")
    .eq("id", parsed.kpi_id)
    .single();

  const rawInputs =
    parsed.variable_inputs && Object.keys(parsed.variable_inputs).length > 0
      ? parsed.variable_inputs
      : parsed.valor_real!;

  const { valorReal, variableInputs } = await computeKpiValueFromInputs(
    parsed.kpi_id,
    rawInputs
  );

  const insertPayload = {
    kpi_id: parsed.kpi_id,
    hotel_id: parsed.hotel_id ?? kpi?.hotel_id ?? null,
    region_id: parsed.region_id ?? kpi?.region_id ?? null,
    fecha: parsed.fecha,
    valor_real: valorReal,
    valor_meta: parsed.valor_meta ?? kpi?.meta ?? null,
    fuente: "manual" as const,
    ...(variableInputs ? { variable_inputs: variableInputs } : {}),
  };

  let { data, error } = await supabase
    .from("kpi_values")
    .insert(insertPayload)
    .select()
    .single();

  if (error?.message.includes("variable_inputs")) {
    const retry = await supabase
      .from("kpi_values")
      .insert({
        kpi_id: insertPayload.kpi_id,
        hotel_id: insertPayload.hotel_id,
        region_id: insertPayload.region_id,
        fecha: insertPayload.fecha,
        valor_real: insertPayload.valor_real,
        valor_meta: insertPayload.valor_meta,
        fuente: insertPayload.fuente,
      })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);

  const { notifyAlertForKpiValue } = await import(
    "@/modules/alertas/services/alert-service"
  );
  await notifyAlertForKpiValue(data.id).catch(() => {});

  invalidateCache("dashboard");
  invalidateCache("cards");
  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  revalidatePath(`/kpis/${parsed.kpi_id}`);
  return data;
}

export async function deleteKpiValueAction(kpiId: string, valueId: string) {
  const { rol } = await assertPermission("metas.configurar");
  if (rol !== "administrador") {
    throw new Error("Solo un administrador puede eliminar valores registrados");
  }
  const { deleteKpiValue } = await import("../services/kpi-service");
  await deleteKpiValue(kpiId, valueId);
  invalidateCache("dashboard");
  invalidateCache("cards");
  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  revalidatePath(`/kpis/${kpiId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  kpiCreateSchema,
  kpiValueSchema,
  type KpiCreateInput,
  type KpiValueInput,
} from "@/lib/validations/schemas";
import { formatZodError } from "@/lib/validations/format-zod-error";

export async function createKpiAction(input: KpiCreateInput) {
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

  let valorReal = parsed.valor_real;

  const { computeKpiValueReal } = await import("@/lib/kpis/compute-formula-value");
  valorReal = await computeKpiValueReal(parsed.kpi_id, parsed.valor_real);

  const { data, error } = await supabase
    .from("kpi_values")
    .insert({
      kpi_id: parsed.kpi_id,
      hotel_id: parsed.hotel_id ?? kpi?.hotel_id ?? null,
      region_id: parsed.region_id ?? kpi?.region_id ?? null,
      fecha: parsed.fecha,
      valor_real: valorReal,
      valor_meta: parsed.valor_meta ?? kpi?.meta ?? null,
      fuente: "manual",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { notifyAlertForKpiValue } = await import(
    "@/modules/alertas/services/alert-service"
  );
  await notifyAlertForKpiValue(data.id).catch(() => {});

  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  revalidatePath(`/kpis/${parsed.kpi_id}`);
  return data;
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  kpiCreateSchema,
  kpiValueSchema,
  type KpiCreateInput,
  type KpiValueInput,
} from "@/lib/validations/schemas";

export async function createKpiAction(input: KpiCreateInput) {
  const parsed = kpiCreateSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("kpis")
    .insert({ ...parsed, created_by: user.id, updated_by: user.id })
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

export async function registerKpiValueAction(input: KpiValueInput) {
  const parsed = kpiValueSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: kpi } = await supabase
    .from("kpis")
    .select("hotel_id, region_id, meta")
    .eq("id", parsed.kpi_id)
    .single();

  const { data, error } = await supabase
    .from("kpi_values")
    .insert({
      kpi_id: parsed.kpi_id,
      hotel_id: parsed.hotel_id ?? kpi?.hotel_id ?? null,
      region_id: parsed.region_id ?? kpi?.region_id ?? null,
      fecha: parsed.fecha,
      valor_real: parsed.valor_real,
      valor_meta: parsed.valor_meta ?? kpi?.meta ?? null,
      fuente: "manual",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  return data;
}

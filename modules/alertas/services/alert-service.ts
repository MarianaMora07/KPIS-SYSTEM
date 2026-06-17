import { createClient } from "@/lib/supabase/server";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";
import type { AlertRow } from "../types";

export async function listAlerts(estado?: "activa" | "escalada" | "resuelta") {
  const supabase = await createClient();
  let query = supabase
    .from("alerts")
    .select(
      `
      *,
      kpis(nombre),
      hotels(nombre),
      regions(nombre)
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapAlertRow(row));
}

export async function getAlertById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select(
      `
      *,
      kpis(nombre),
      hotels(nombre),
      regions(nombre)
    `
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapAlertRow(data);
}

export async function resolveAlert(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({ estado: "resuelta", resuelta_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function escalateAlert(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .update({
      estado: "escalada",
      escalada: true,
      escalada_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await dispatchActivepiecesEvent("kpi.alert.escalated", {
    alertId: data.id,
    kpiId: data.kpi_id,
    mensaje: data.mensaje,
    severidad: data.severidad,
  });

  return data;
}

export async function notifyAlertForKpiValue(kpiValueId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("kpi_value_id", kpiValueId)
    .in("estado", ["activa", "escalada"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  await dispatchActivepiecesEvent("kpi.alert.created", {
    alertId: data.id,
    kpiId: data.kpi_id,
    hotelId: data.hotel_id,
    severidad: data.severidad,
    mensaje: data.mensaje,
  });

  if (data.estado === "escalada" || data.escalada) {
    await dispatchActivepiecesEvent("kpi.alert.escalated", {
      alertId: data.id,
      kpiId: data.kpi_id,
      mensaje: data.mensaje,
      severidad: data.severidad,
    });
  }

  return data;
}

export async function listActionPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("action_plans")
    .select(
      `
      *,
      kpis(nombre),
      action_plan_items(id, descripcion, completado)
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    estado: p.estado,
    fecha_compromiso: p.fecha_compromiso,
    kpi_nombre: (p.kpis as { nombre?: string } | null)?.nombre,
    items: (p.action_plan_items as { id: string; descripcion: string; completado: boolean }[]) ?? [],
  }));
}

export async function updatePlanStatus(planId: string, estado: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("action_plans")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(error.message);
}

export async function togglePlanItem(itemId: string, completado: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("action_plan_items")
    .update({
      completado,
      completado_at: completado ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAlertRow(row: any): AlertRow {
  return {
    id: row.id,
    kpi_id: row.kpi_id,
    kpi_value_id: row.kpi_value_id,
    kpi_target_id: row.kpi_target_id ?? null,
    hotel_id: row.hotel_id,
    region_id: row.region_id,
    severidad: row.severidad,
    estado: row.estado,
    mensaje: row.mensaje,
    escalada: row.escalada,
    escalada_at: row.escalada_at,
    resuelta_at: row.resuelta_at,
    created_at: row.created_at,
    kpi_nombre: row.kpis?.nombre,
    hotel_nombre: row.hotels?.nombre,
    region_nombre: row.regions?.nombre,
  };
}

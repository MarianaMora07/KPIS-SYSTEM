import { createClient } from "@/lib/supabase/server";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";
import type { AlertRow, AlertStatus } from "../types";

export type AlertStatusFilter = AlertStatus | "abiertas";

export interface AlertListFilters {
  hotelId?: string;
  regionId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

const OPEN_ALERT_STATUSES: AlertStatus[] = ["activa", "escalada"];

export async function listAlerts(
  estado?: AlertStatusFilter,
  filters?: AlertListFilters
) {
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

  if (estado === "abiertas") {
    query = query.in("estado", OPEN_ALERT_STATUSES);
  } else if (estado) {
    query = query.eq("estado", estado);
  }

  if (filters?.hotelId) query = query.eq("hotel_id", filters.hotelId);
  if (filters?.regionId) query = query.eq("region_id", filters.regionId);
  if (filters?.fechaDesde) query = query.gte("created_at", filters.fechaDesde);
  if (filters?.fechaHasta) {
    query = query.lte("created_at", `${filters.fechaHasta}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapAlertRow(row));
}

/** Alertas activas y escaladas (no resueltas). */
export async function listOpenAlerts(filters?: AlertListFilters) {
  return listAlerts("abiertas", filters);
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
  const { data, error } = await supabase
    .from("alerts")
    .update({ estado: "resuelta", resuelta_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo resolver la alerta");
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

export async function getActionPlanById(planId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("action_plans")
    .select(
      `
      *,
      kpis(nombre, codigo),
      action_plan_items(id, descripcion, completado)
    `
    )
    .eq("id", planId)
    .single();

  if (error) throw new Error(error.message);

  let responsable_nombre: string | undefined;
  let responsable_email: string | undefined;

  if (data.responsable_id) {
    const { data: responsable } = await supabase
      .from("user_profiles")
      .select("nombre, apellido, email")
      .eq("id", data.responsable_id)
      .maybeSingle();
    if (responsable) {
      responsable_nombre = [responsable.nombre, responsable.apellido]
        .filter(Boolean)
        .join(" ");
      responsable_email = responsable.email ?? undefined;
    }
  }

  const kpi = data.kpis as { nombre?: string; codigo?: string } | null;

  return {
    id: data.id as string,
    titulo: data.titulo as string,
    descripcion: (data.descripcion as string | null) ?? null,
    estado: data.estado as string,
    fecha_compromiso: data.fecha_compromiso as string,
    created_at: data.created_at as string,
    responsable_id: data.responsable_id as string | null,
    kpi_nombre: kpi?.nombre,
    kpi_codigo: kpi?.codigo,
    responsable_nombre,
    responsable_email,
    items:
      (data.action_plan_items as {
        id: string;
        descripcion: string;
        completado: boolean;
      }[]) ?? [],
  };
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
    alert_id: p.alert_id as string | null,
    kpi_nombre: (p.kpis as { nombre?: string } | null)?.nombre,
    items: (p.action_plan_items as { id: string; descripcion: string; completado: boolean }[]) ?? [],
  }));
}

export async function deleteActionPlan(planId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("action_plans").delete().eq("id", planId);
  if (error) throw new Error(error.message);
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

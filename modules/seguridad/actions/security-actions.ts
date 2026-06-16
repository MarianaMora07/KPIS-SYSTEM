"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assignRole,
  setUserActive,
  setUserHotelScopes,
  setUserRegionScopes,
} from "../services/security-service";
import type { AppRole } from "@/types/database";

export async function assignRoleAction(userId: string, rol: AppRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: callerRole } = await supabase
    .from("user_roles")
    .select("rol")
    .eq("user_id", user.id)
    .single();

  if (callerRole?.rol !== "administrador") {
    throw new Error("Solo un administrador puede asignar roles");
  }

  await assignRole(userId, rol, user.id);
  revalidatePath("/seguridad");
}

export async function toggleUserActiveAction(userId: string, activo: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: callerRole } = await supabase
    .from("user_roles")
    .select("rol")
    .eq("user_id", user.id)
    .single();

  if (callerRole?.rol !== "administrador") {
    throw new Error("Solo un administrador puede activar o desactivar usuarios");
  }

  await setUserActive(userId, activo);
  revalidatePath("/seguridad");
}

export async function setScopesAction(
  userId: string,
  hotelIds: string[],
  regionIds: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: callerRole } = await supabase
    .from("user_roles")
    .select("rol")
    .eq("user_id", user.id)
    .single();

  if (callerRole?.rol !== "administrador") {
    throw new Error("Solo un administrador puede asignar alcances");
  }

  if (userId === user.id) {
    throw new Error("No puede modificar su propio alcance");
  }

  await setUserHotelScopes(userId, hotelIds);
  await setUserRegionScopes(userId, regionIds);
  revalidatePath("/seguridad");
}

export async function filterAuditLogsAction(filters: {
  entidad?: string;
  usuarioEmail?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  const { listAuditLogs } = await import("../services/security-service");
  return listAuditLogs(filters);
}

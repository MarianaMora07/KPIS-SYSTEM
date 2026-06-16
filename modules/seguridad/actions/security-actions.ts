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

  await assignRole(userId, rol, user.id);
  revalidatePath("/seguridad");
}

export async function toggleUserActiveAction(userId: string, activo: boolean) {
  await setUserActive(userId, activo);
  revalidatePath("/seguridad");
}

export async function setScopesAction(
  userId: string,
  hotelIds: string[],
  regionIds: string[]
) {
  await setUserHotelScopes(userId, hotelIds);
  await setUserRegionScopes(userId, regionIds);
  revalidatePath("/seguridad");
}

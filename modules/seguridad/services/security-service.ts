import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, user_roles(rol)")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listAuditLogs(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}

export async function assignRole(userId: string, rol: AppRole, asignadoPor: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    rol,
    asignado_por: asignadoPor,
  });

  if (error) throw new Error(error.message);
}

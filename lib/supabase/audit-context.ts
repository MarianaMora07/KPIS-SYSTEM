import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Establece app.current_user_id para fn_audit_trigger antes de mutaciones
 * con service role o sin sesión auth (p. ej. cron de integraciones).
 */
export async function setAuditUserContext(
  supabase: SupabaseClient,
  userId: string | null
): Promise<void> {
  const { error } = await supabase.rpc("set_audit_user_context", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function withAuditUserContext<T>(
  supabase: SupabaseClient,
  userId: string | null,
  fn: () => Promise<T>
): Promise<T> {
  await setAuditUserContext(supabase, userId);
  try {
    return await fn();
  } finally {
    await setAuditUserContext(supabase, null);
  }
}

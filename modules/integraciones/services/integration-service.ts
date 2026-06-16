import { createClient } from "@/lib/supabase/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60_000
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count++;
  return { allowed: true };
}

export async function listIntegrations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_integrations")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  return data;
}

export async function createIntegration(input: {
  nombre: string;
  sistema_tipo: string;
  endpoint_url: string;
  auth_config?: Record<string, unknown>;
  mapeo_campos?: Record<string, string>;
  frecuencia_cron?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_integrations")
    .insert({
      ...input,
      auth_config: input.auth_config ?? {},
      mapeo_campos: input.mapeo_campos ?? {},
      activa: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateIntegration(
  id: string,
  input: Partial<{
    nombre: string;
    endpoint_url: string;
    auth_config: Record<string, unknown>;
    mapeo_campos: Record<string, string>;
    frecuencia_cron: string;
    activa: boolean;
  }>
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_integrations")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleIntegrationActive(id: string, activa: boolean) {
  return updateIntegration(id, { activa });
}

export async function triggerSync(integrationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integration_jobs")
    .insert({
      integration_id: integrationId,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listIntegrationJobs(integrationId: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integration_jobs")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listIntegrationLogs(jobId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integration_logs")
    .select("*")
    .eq("integration_job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listIntegrationsDueForCron() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_integrations")
    .select("*")
    .eq("activa", true)
    .not("frecuencia_cron", "is", null);

  if (error) throw new Error(error.message);
  return data ?? [];
}

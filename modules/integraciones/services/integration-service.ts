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

export interface IntegrationDeleteImpactValue {
  id: string;
  fecha: string;
  valor_real: number;
  kpi_codigo: string;
  kpi_nombre: string;
}

export interface IntegrationDeleteImpact {
  kpiValuesCount: number;
  values: IntegrationDeleteImpactValue[];
}

export async function getIntegrationDeleteImpact(
  integrationId: string
): Promise<IntegrationDeleteImpact> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_values")
    .select("id, fecha, valor_real, kpis(codigo, nombre)")
    .eq("integration_id", integrationId)
    .order("fecha", { ascending: false });

  if (error) {
    if (error.message.includes("integration_id")) {
      return { kpiValuesCount: 0, values: [] };
    }
    throw new Error(error.message);
  }

  const values: IntegrationDeleteImpactValue[] = (data ?? []).map((row) => {
    const kpiRaw = row.kpis as
      | { codigo: string; nombre: string }
      | { codigo: string; nombre: string }[]
      | null;
    const kpi = Array.isArray(kpiRaw) ? kpiRaw[0] : kpiRaw;
    return {
      id: row.id as string,
      fecha: row.fecha as string,
      valor_real: Number(row.valor_real),
      kpi_codigo: kpi?.codigo ?? "—",
      kpi_nombre: kpi?.nombre ?? "KPI",
    };
  });

  return { kpiValuesCount: values.length, values };
}

export async function countIntegrationKpiValues(integrationId: string): Promise<number> {
  const impact = await getIntegrationDeleteImpact(integrationId);
  return impact.kpiValuesCount;
}

export async function deleteIntegration(
  id: string
): Promise<{ kpiValuesDeleted: number }> {
  const supabase = await createClient();
  const kpiValuesDeleted = await countIntegrationKpiValues(id);

  if (kpiValuesDeleted > 0) {
    const { error: valuesError } = await supabase
      .from("kpi_values")
      .delete()
      .eq("integration_id", id);

    if (valuesError && !valuesError.message.includes("integration_id")) {
      throw new Error(valuesError.message);
    }
  }

  const { error } = await supabase.from("external_integrations").delete().eq("id", id);
  if (error) throw new Error(error.message);

  return { kpiValuesDeleted };
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

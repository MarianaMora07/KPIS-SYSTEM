import { createClient } from "@/lib/supabase/server";

export async function listIntegrations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("external_integrations")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  return data;
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

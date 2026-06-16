import { createClient } from "@/lib/supabase/server";

export interface ScheduledReportRow {
  id: string;
  nombre: string;
  filtros: Record<string, unknown>;
  frecuencia_cron: string;
  formato: string;
  emails: string[];
  activo: boolean;
  ultima_ejecucion: string | null;
}

export async function listScheduledReports(userId: string): Promise<ScheduledReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_reports")
    .select("*")
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledReportRow[];
}

export async function createScheduledReport(
  userId: string,
  input: {
    nombre: string;
    frecuencia_cron: string;
    formato: string;
    emails: string[];
    filtros?: Record<string, unknown>;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_reports")
    .insert({
      usuario_id: userId,
      nombre: input.nombre,
      frecuencia_cron: input.frecuencia_cron,
      formato: input.formato,
      emails: input.emails,
      filtros: input.filtros ?? {},
      activo: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleScheduledReport(id: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_reports")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteScheduledReport(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("scheduled_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

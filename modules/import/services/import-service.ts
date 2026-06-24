import { createClient } from "@/lib/supabase/server";
import type { ImportFileInput } from "@/lib/validations/schemas";
import { importFileSchema } from "@/lib/validations/schemas";

/**
 * Trazabilidad de importación (equiv. estelar-kpi):
 * - Origen: kpi_measurements.imported_by
 * - Destino: import_jobs.usuario_id + kpi_values.fuente = 'manual' | 'integracion'
 */

export async function createImportJob(input: ImportFileInput, userId: string) {
  const parsed = importFileSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .insert({
      nombre_archivo: parsed.nombre_archivo,
      tipo_archivo: parsed.tipo_archivo,
      plantilla_tipo: parsed.plantilla_tipo ?? null,
      usuario_id: userId,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getImportJobStatus(jobId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*, import_job_errors(*)")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listImportJobs(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select("id, nombre_archivo, estado, total_filas, filas_ok, filas_error, created_at")
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

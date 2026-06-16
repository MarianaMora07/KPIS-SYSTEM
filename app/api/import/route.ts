import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { processImportJob } from "@/modules/import/services/import-processor";

const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Configure Supabase para importar archivos" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Archivo supera 5 MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "xlsx" && ext !== "csv") {
    return NextResponse.json(
      { error: "Solo .xlsx o .csv" },
      { status: 400 }
    );
  }

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      usuario_id: user.id,
      nombre_archivo: file.name,
      tipo_archivo: ext,
      plantilla_tipo: "kpi_values",
      estado: "pendiente",
    })
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? "Error al crear job" },
      { status: 500 }
    );
  }

  const storagePath = `${user.id}/${job.id}/${file.name}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("imports")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    await supabase.from("import_jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await supabase
    .from("import_jobs")
    .update({ storage_path: storagePath })
    .eq("id", job.id);

  // Procesar en background (fire-and-forget dentro del mismo request)
  processImportJob(job.id).catch(console.error);

  return NextResponse.json({
    jobId: job.id,
    estado: "pendiente",
  });
}

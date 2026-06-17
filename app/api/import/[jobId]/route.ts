import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*, import_job_errors(*)")
    .eq("id", jobId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: job, error: fetchError } = await supabase
    .from("import_jobs")
    .select("id, storage_path, usuario_id")
    .eq("id", jobId)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Importación no encontrada" }, { status: 404 });
  }

  if (job.storage_path) {
    await supabase.storage.from("imports").remove([job.storage_path]);
  }

  const { error: deleteError } = await supabase
    .from("import_jobs")
    .delete()
    .eq("id", jobId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

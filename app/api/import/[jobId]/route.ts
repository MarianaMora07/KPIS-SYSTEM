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

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { listIntegrationJobs } from "@/modules/integraciones/services/integration-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const jobs = await listIntegrationJobs(id);
  return NextResponse.json(jobs);
}

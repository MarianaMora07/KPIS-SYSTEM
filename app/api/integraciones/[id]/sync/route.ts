import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { triggerSync, checkRateLimit } from "@/modules/integraciones/services/integration-service";
import { processIntegrationSync } from "@/modules/integraciones/services/integration-sync-processor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const rate = checkRateLimit(`sync:${id}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intente más tarde." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rate.retryAfterMs ?? 60000) / 1000)) } }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const job = await triggerSync(id);
    const result = await processIntegrationSync(id, job.id, {
      triggeredByUserId: user.id,
    });

    return NextResponse.json({
      jobId: job.id,
      estado: result.ok ? "completado" : "fallido",
      registrosOk: result.registrosOk,
      registrosError: result.registrosError,
      error: result.error,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

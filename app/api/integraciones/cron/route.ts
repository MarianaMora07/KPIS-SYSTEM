import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  listIntegrationsDueForCron,
  triggerSync,
} from "@/modules/integraciones/services/integration-service";
import { processIntegrationSync } from "@/modules/integraciones/services/integration-sync-processor";
import { checkRateLimit } from "@/modules/integraciones/services/integration-service";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const rate = checkRateLimit("cron:integraciones", 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const integrations = await listIntegrationsDueForCron();
  const results = [];

  for (const integration of integrations) {
    const job = await triggerSync(integration.id);
    const result = await processIntegrationSync(integration.id, job.id);
    results.push({ integrationId: integration.id, jobId: job.id, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}

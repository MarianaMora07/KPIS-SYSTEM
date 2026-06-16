import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createIntegration } from "@/modules/integraciones/services/integration-service";

export async function POST(request: Request) {
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

  const body = await request.json();
  const integration = await createIntegration(body);
  return NextResponse.json(integration);
}

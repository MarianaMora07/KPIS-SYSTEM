import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { deleteIntegration } from "@/modules/integraciones/services/integration-service";
import { invalidateCache } from "@/lib/cache/dashboard-cache";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  try {
    const { kpiValuesDeleted } = await deleteIntegration(id);
    invalidateCache("dashboard");
    invalidateCache("cards");
    revalidatePath("/dashboard");
    revalidatePath("/kpis");
    return NextResponse.json({ ok: true, kpiValuesDeleted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

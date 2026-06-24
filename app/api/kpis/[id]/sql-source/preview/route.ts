import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { assertPermission } from "@/lib/auth/require-permission";
import { previewKpiSqlQuery } from "@/modules/sql-data-sources/services/sql-source-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  try {
    await assertPermission("kpis.editar");
    const body = await request.json().catch(() => ({}));
    const result = await previewKpiSqlQuery(id, body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}

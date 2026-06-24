import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { assertPermission } from "@/lib/auth/require-permission";
import {
  deleteDatabaseConnection,
  getDatabaseConnectionById,
  testConnectionById,
  updateDatabaseConnection,
} from "@/modules/sql-data-sources/services/connection-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  try {
    await assertPermission("integraciones.gestionar");
    const connection = await getDatabaseConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    const { password_encrypted: _, ...safe } = connection;
    return NextResponse.json(safe);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 403 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  try {
    await assertPermission("integraciones.gestionar");
    const body = await request.json();
    const connection = await updateDatabaseConnection(id, body);
    return NextResponse.json(connection);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  try {
    await assertPermission("integraciones.gestionar");
    await deleteDatabaseConnection(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}

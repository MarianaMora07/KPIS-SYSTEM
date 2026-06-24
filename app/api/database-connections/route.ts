import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { getUserPermissions } from "@/lib/auth/permissions";
import { hasPermissionInList } from "@/lib/auth/role-matrix";
import {
  createDatabaseConnection,
  listDatabaseConnections,
} from "@/modules/sql-data-sources/services/connection-service";

async function canReadConnections() {
  const { permissions } = await getUserPermissions();
  return (
    hasPermissionInList(permissions, "integraciones.gestionar") ||
    hasPermissionInList(permissions, "kpis.editar")
  );
}

async function canManageConnections() {
  const { permissions } = await getUserPermissions();
  return hasPermissionInList(permissions, "integraciones.gestionar");
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  try {
    if (!(await canReadConnections())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const connections = await listDatabaseConnections();
    return NextResponse.json(connections);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 403 }
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  try {
    if (!(await canManageConnections())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const body = await request.json();
    const connection = await createDatabaseConnection(body);
    return NextResponse.json(connection);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}

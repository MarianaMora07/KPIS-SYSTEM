import { createClient } from "@/lib/supabase/server";
import {
  encryptConnectionPassword,
  testDatabaseConnection,
  type DatabaseConnectionRow,
  type PostgresExternalConfig,
} from "@/lib/sql";

export interface DatabaseConnectionInput {
  nombre: string;
  tipo: "supabase_internal" | "postgres_external";
  config?: PostgresExternalConfig;
  password?: string;
  activa?: boolean;
}

function serializeConnection(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    nombre: row.nombre as string,
    tipo: row.tipo as string,
    config: (row.config as Record<string, unknown>) ?? {},
    activa: row.activa as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function listDatabaseConnections() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("database_connections")
    .select("id, nombre, tipo, config, activa, created_at, updated_at")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []).map(serializeConnection);
}

export async function getDatabaseConnectionById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("database_connections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DatabaseConnectionRow | null;
}

export async function createDatabaseConnection(input: DatabaseConnectionInput) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    nombre: input.nombre,
    tipo: input.tipo,
    config: input.config ?? {},
    activa: input.activa ?? true,
  };

  if (input.tipo === "postgres_external" && input.password) {
    payload.password_encrypted = encryptConnectionPassword(input.password);
  }

  const { data, error } = await supabase
    .from("database_connections")
    .insert(payload)
    .select("id, nombre, tipo, config, activa, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return serializeConnection(data);
}

export async function updateDatabaseConnection(
  id: string,
  input: Partial<DatabaseConnectionInput>
) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.nombre !== undefined) payload.nombre = input.nombre;
  if (input.tipo !== undefined) payload.tipo = input.tipo;
  if (input.config !== undefined) payload.config = input.config;
  if (input.activa !== undefined) payload.activa = input.activa;
  if (input.password) {
    payload.password_encrypted = encryptConnectionPassword(input.password);
  }

  const { data, error } = await supabase
    .from("database_connections")
    .update(payload)
    .eq("id", id)
    .select("id, nombre, tipo, config, activa, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return serializeConnection(data);
}

export async function deleteDatabaseConnection(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("database_connections").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function testConnectionById(id: string) {
  const connection = await getDatabaseConnectionById(id);
  if (!connection) throw new Error("Conexión no encontrada");
  return testDatabaseConnection(connection);
}

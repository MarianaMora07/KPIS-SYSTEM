import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import { decryptConnectionPassword } from "./connection-secret";

export type DatabaseConnectionType = "supabase_internal" | "postgres_external";

export interface DatabaseConnectionRow {
  id: string;
  nombre: string;
  tipo: DatabaseConnectionType;
  config: Record<string, unknown>;
  password_encrypted?: Buffer | null;
  activa: boolean;
}

export interface PostgresExternalConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  ssl?: boolean;
}

const QUERY_TIMEOUT_MS = 10_000;

const POOLER_HINT =
  "En Windows/redes sin IPv6, la conexión Direct (db.*.supabase.co) no resuelve DNS. " +
  "En Supabase → Connect → Direct, use Session pooler (puerto 5432) o Transaction pooler (6543) " +
  "con host aws-*.pooler.supabase.com y usuario postgres.[project-ref].";

function formatConnectionError(e: unknown): string {
  const message = e instanceof Error ? e.message : "Error de conexión";
  if (
    message.includes("ENOTFOUND") &&
    message.includes("db.") &&
    message.includes(".supabase.co")
  ) {
    return `${message}. ${POOLER_HINT}`;
  }
  return message;
}

function getInternalDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no configurada para conexión Supabase interna"
    );
  }
  return url;
}

function buildPoolConfig(connection: DatabaseConnectionRow): PoolConfig {
  if (connection.tipo === "supabase_internal") {
    return {
      connectionString: getInternalDatabaseUrl(),
      max: 2,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: QUERY_TIMEOUT_MS,
      statement_timeout: QUERY_TIMEOUT_MS,
      query_timeout: QUERY_TIMEOUT_MS,
    };
  }

  const cfg = connection.config as unknown as PostgresExternalConfig;
  const password = decryptConnectionPassword(
    connection.password_encrypted as Buffer | null
  );
  if (!password) {
    throw new Error("La conexión externa no tiene contraseña configurada");
  }

  return {
    host: cfg.host,
    port: cfg.port ?? 5432,
    database: cfg.database,
    user: cfg.user,
    password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  };
}

export async function executeReadOnlyQuery<T extends QueryResultRow = QueryResultRow>(
  connection: DatabaseConnectionRow,
  sql: string
): Promise<T[]> {
  const pool = new Pool(buildPoolConfig(connection));
  try {
    const client = await pool.connect();
    try {
      const result = await client.query<T>(sql);
      return result.rows;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

export async function testDatabaseConnection(
  connection: DatabaseConnectionRow
): Promise<{ ok: boolean; error?: string }> {
  try {
    await executeReadOnlyQuery(connection, "SELECT 1 AS ok");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: formatConnectionError(e),
    };
  }
}

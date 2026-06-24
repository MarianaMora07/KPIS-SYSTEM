import {
  appendQueryLimit,
  buildStructuredSql,
  sqlClausesFromKpiSource,
  type SqlClauses,
} from "./build-structured-query";
import { executeReadOnlyQuery, type DatabaseConnectionRow } from "./execute-query";
import { mapQueryRowsToKpiRecords } from "./map-query-rows";
import { validateReadOnlySql } from "./validate-readonly-sql";

export interface KpiSqlSourceRow {
  kpi_id: string;
  connection_id: string;
  clause_select: string;
  clause_from: string;
  clause_where?: string | null;
  clause_group_by?: string | null;
  clause_having?: string | null;
  clause_order_by?: string | null;
  distinct_rows?: boolean;
  fecha_column: string;
  hotel_column?: string | null;
  variable_column_map: Record<string, string>;
}

export async function runStructuredSqlQuery(
  connection: DatabaseConnectionRow,
  clauses: SqlClauses,
  options?: { limit?: number }
): Promise<{ sql: string; rows: Record<string, unknown>[] }> {
  const baseSql = buildStructuredSql(clauses);
  const sql = appendQueryLimit(baseSql, options?.limit);
  const validation = validateReadOnlySql(sql);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Consulta no válida");
  }
  const rows = await executeReadOnlyQuery<Record<string, unknown>>(connection, sql);
  return { sql, rows };
}

export async function runKpiSqlSourceQuery(
  connection: DatabaseConnectionRow,
  source: KpiSqlSourceRow,
  kpiCodigo: string,
  formulaVariableCodes: string[] = [],
  options?: { limit?: number }
) {
  const clauses = sqlClausesFromKpiSource(source);
  const { sql, rows } = await runStructuredSqlQuery(connection, clauses, options);
  const records = mapQueryRowsToKpiRecords(rows, kpiCodigo, source, formulaVariableCodes);
  return { sql, rows, records };
}

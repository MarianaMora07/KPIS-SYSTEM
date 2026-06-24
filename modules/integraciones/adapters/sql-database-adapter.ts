import type {
  ExternalKpiRecord,
  IntegrationAdapter,
  IntegrationRecord,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { getDatabaseConnectionById } from "@/modules/sql-data-sources/services/connection-service";
import { listKpiSqlSourcesByConnection } from "@/modules/sql-data-sources/services/sql-source-service";
import {
  runKpiSqlSourceQuery,
  type KpiSqlSourceRow,
} from "@/lib/sql";
import { getRequiredInputVariableCodes } from "@/lib/kpis/compute-formula-value";

export class SqlDatabaseAdapter implements IntegrationAdapter {
  async fetchRecords(integration: IntegrationRecord): Promise<ExternalKpiRecord[]> {
    const connectionId = (integration.auth_config as { connection_id?: string })
      .connection_id;
    if (!connectionId) {
      throw new Error("Integración SQL sin connection_id en auth_config");
    }

    const connection = await getDatabaseConnectionById(connectionId);
    if (!connection) {
      throw new Error("Conexión de base de datos no encontrada");
    }

    const sources = await listKpiSqlSourcesByConnection(connectionId);
    if (sources.length === 0) {
      return [];
    }

    const allRecords: ExternalKpiRecord[] = [];

    for (const row of sources) {
      const kpiRaw = row.kpis as { codigo: string } | { codigo: string }[] | null;
      const kpiMeta = Array.isArray(kpiRaw) ? kpiRaw[0] : kpiRaw;
      const kpiCodigo = kpiMeta?.codigo;
      if (!kpiCodigo) continue;

      const source: KpiSqlSourceRow = {
        kpi_id: row.kpi_id as string,
        connection_id: row.connection_id as string,
        clause_select: row.clause_select as string,
        clause_from: row.clause_from as string,
        clause_where: row.clause_where as string | null,
        clause_group_by: row.clause_group_by as string | null,
        clause_having: row.clause_having as string | null,
        clause_order_by: row.clause_order_by as string | null,
        distinct_rows: row.distinct_rows as boolean,
        fecha_column: row.fecha_column as string,
        hotel_column: row.hotel_column as string | null,
        variable_column_map: (row.variable_column_map as Record<string, string>) ?? {},
      };

      const formulaVariableCodes = await getRequiredInputVariableCodes(source.kpi_id);
      const { records } = await runKpiSqlSourceQuery(
        connection,
        source,
        kpiCodigo,
        formulaVariableCodes
      );
      allRecords.push(...records);
    }

    return allRecords;
  }
}

export async function logSqlSyncQueries(
  integrationId: string,
  jobId: string,
  connectionId: string
): Promise<void> {
  const supabase = await createClient();
  const sources = await listKpiSqlSourcesByConnection(connectionId);
  for (const src of sources) {
    const { buildStructuredSql } = await import("@/lib/sql");
    const sql = buildStructuredSql({
      select: src.clause_select as string,
      from: src.clause_from as string,
      where: src.clause_where as string | null,
      groupBy: src.clause_group_by as string | null,
      having: src.clause_having as string | null,
      orderBy: src.clause_order_by as string | null,
      distinct: src.distinct_rows as boolean,
    });
    await supabase.from("integration_logs").insert({
      integration_job_id: jobId,
      nivel: "info",
      mensaje: `SQL KPI ${src.kpi_id}`,
      payload: { sql, kpi_id: src.kpi_id },
    });
  }
}

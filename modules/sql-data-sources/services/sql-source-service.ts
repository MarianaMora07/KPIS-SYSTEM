import { createClient } from "@/lib/supabase/server";
import {
  computeKpiValueFromInputs,
  getRequiredInputVariableCodes,
} from "@/lib/kpis/compute-formula-value";
import {
  buildStructuredSql,
  runKpiSqlSourceQuery,
  type KpiSqlSourceRow,
  type SqlClauses,
} from "@/lib/sql";
import { getDatabaseConnectionById } from "./connection-service";
import type { ExternalKpiRecord } from "@/modules/integraciones/adapters/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface KpiSqlSourceInput {
  connection_id: string;
  clause_select: string;
  clause_from: string;
  clause_where?: string | null;
  clause_group_by?: string | null;
  clause_having?: string | null;
  clause_order_by?: string | null;
  distinct_rows?: boolean;
  fecha_column?: string;
  hotel_column?: string | null;
  variable_column_map?: Record<string, string>;
}

export interface KpiSqlSourceDto extends KpiSqlSourceInput {
  kpi_id: string;
  assembled_sql?: string;
}

function toDto(row: KpiSqlSourceRow & { assembled_sql?: string }): KpiSqlSourceDto {
  return {
    kpi_id: row.kpi_id,
    connection_id: row.connection_id,
    clause_select: row.clause_select,
    clause_from: row.clause_from,
    clause_where: row.clause_where,
    clause_group_by: row.clause_group_by,
    clause_having: row.clause_having,
    clause_order_by: row.clause_order_by,
    distinct_rows: row.distinct_rows ?? false,
    fecha_column: row.fecha_column ?? "fecha",
    hotel_column: row.hotel_column,
    variable_column_map: (row.variable_column_map as Record<string, string>) ?? {},
    assembled_sql: row.assembled_sql,
  };
}

export async function getKpiSqlSource(kpiId: string): Promise<KpiSqlSourceDto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_sql_sources")
    .select("*")
    .eq("kpi_id", kpiId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const assembled_sql = buildStructuredSql({
    select: data.clause_select,
    from: data.clause_from,
    where: data.clause_where,
    groupBy: data.clause_group_by,
    having: data.clause_having,
    orderBy: data.clause_order_by,
    distinct: data.distinct_rows,
  });

  return toDto({ ...(data as KpiSqlSourceRow), assembled_sql });
}

export async function saveKpiSqlSource(kpiId: string, input: KpiSqlSourceInput) {
  const supabase = await createClient();
  const payload = {
    kpi_id: kpiId,
    connection_id: input.connection_id,
    clause_select: input.clause_select.trim(),
    clause_from: input.clause_from.trim(),
    clause_where: input.clause_where?.trim() || null,
    clause_group_by: input.clause_group_by?.trim() || null,
    clause_having: input.clause_having?.trim() || null,
    clause_order_by: input.clause_order_by?.trim() || null,
    distinct_rows: input.distinct_rows ?? false,
    fecha_column: input.fecha_column?.trim() || "fecha",
    hotel_column: input.hotel_column?.trim() || null,
    variable_column_map: input.variable_column_map ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("kpi_sql_sources")
    .upsert(payload, { onConflict: "kpi_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return getKpiSqlSource(kpiId);
}

export async function deleteKpiSqlSource(kpiId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("kpi_sql_sources").delete().eq("kpi_id", kpiId);
  if (error) throw new Error(error.message);
}

export async function listKpiSqlSourcesByConnection(connectionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_sql_sources")
    .select("*, kpis(codigo)")
    .eq("connection_id", connectionId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function resolveHotelId(
  supabase: SupabaseClient,
  hotelCodigo?: string
): Promise<string | null> {
  if (!hotelCodigo) return null;
  const { data } = await supabase
    .from("hotels")
    .select("id")
    .eq("codigo", hotelCodigo)
    .maybeSingle();
  return data?.id ?? null;
}

export async function previewKpiSqlQuery(
  kpiId: string,
  overrides?: Partial<KpiSqlSourceInput>
) {
  const supabase = await createClient();
  const { data: kpi } = await supabase
    .from("kpis")
    .select("codigo")
    .eq("id", kpiId)
    .single();
  if (!kpi) throw new Error("KPI no encontrado");

  const existing = await getKpiSqlSource(kpiId);
  const sourceInput = { ...existing, ...overrides } as KpiSqlSourceInput;
  if (!sourceInput.connection_id || !sourceInput.clause_select || !sourceInput.clause_from) {
    throw new Error("Configure conexión, SELECT y FROM");
  }

  const connection = await getDatabaseConnectionById(sourceInput.connection_id);
  if (!connection) throw new Error("Conexión no encontrada");

  const source: KpiSqlSourceRow = {
    kpi_id: kpiId,
    connection_id: sourceInput.connection_id,
    clause_select: sourceInput.clause_select,
    clause_from: sourceInput.clause_from,
    clause_where: sourceInput.clause_where,
    clause_group_by: sourceInput.clause_group_by,
    clause_having: sourceInput.clause_having,
    clause_order_by: sourceInput.clause_order_by,
    distinct_rows: sourceInput.distinct_rows,
    fecha_column: sourceInput.fecha_column ?? "fecha",
    hotel_column: sourceInput.hotel_column,
    variable_column_map: sourceInput.variable_column_map ?? {},
  };

  const formulaVariableCodes = await getRequiredInputVariableCodes(kpiId);
  const { sql, rows, records } = await runKpiSqlSourceQuery(
    connection,
    source,
    kpi.codigo,
    formulaVariableCodes,
    { limit: 20 }
  );

  const enrichedRecords = await Promise.all(
    records.map(async (rec) => {
      try {
        const rawInputs =
          rec.variables && Object.keys(rec.variables).length > 0
            ? rec.variables
            : rec.valor;
        const { valorReal } = await computeKpiValueFromInputs(kpiId, rawInputs);
        return { ...rec, valor_calculado: valorReal };
      } catch {
        return rec;
      }
    })
  );

  return { sql, rows, records: enrichedRecords };
}

export async function previewAdHocSqlQuery(
  connectionId: string,
  clauses: SqlClauses,
  kpiId?: string
) {
  const connection = await getDatabaseConnectionById(connectionId);
  if (!connection) throw new Error("Conexión no encontrada");

  let kpiCodigo = "PREVIEW";
  let formulaVariableCodes: string[] = [];
  if (kpiId) {
    const supabase = await createClient();
    const { data: kpi } = await supabase.from("kpis").select("codigo").eq("id", kpiId).single();
    if (kpi) {
      kpiCodigo = kpi.codigo;
      formulaVariableCodes = await getRequiredInputVariableCodes(kpiId);
    }
  }

  const { runStructuredSqlQuery } = await import("@/lib/sql/run-structured-query");
  const { mapQueryRowsToKpiRecords } = await import("@/lib/sql/map-query-rows");
  const { sql, rows } = await runStructuredSqlQuery(connection, clauses, { limit: 20 });
  const records = mapQueryRowsToKpiRecords(rows, kpiCodigo, {
    fecha_column: "fecha",
    variable_column_map: {},
  }, formulaVariableCodes);

  return { sql, rows, records };
}

type LoadMode = "single" | "all";

export interface SqlLoadResult {
  sql: string;
  loaded: number;
  errors: string[];
  preview?: ExternalKpiRecord;
  records?: ExternalKpiRecord[];
}

async function upsertSqlKpiValue(
  supabase: SupabaseClient,
  params: {
    kpi_id: string;
    hotel_id: string | null;
    region_id: string | null;
    fecha: string;
    valor_real: number;
    variable_inputs: Record<string, number> | null;
    integration_id?: string | null;
    fuente: "sql" | "integracion";
  }
) {
  const base = {
    kpi_id: params.kpi_id,
    hotel_id: params.hotel_id,
    region_id: params.region_id,
    fecha: params.fecha,
    valor_real: params.valor_real,
    valor_meta: null,
    fuente: params.fuente,
    ...(params.integration_id ? { integration_id: params.integration_id } : {}),
  };

  const withVars =
    params.variable_inputs != null
      ? { ...base, variable_inputs: params.variable_inputs }
      : base;

  const { error } = await supabase
    .from("kpi_values")
    .upsert(withVars, { onConflict: "kpi_id,hotel_id,fecha" });

  if (error?.message.includes("variable_inputs") || error?.message.includes("integration_id")) {
    const { error: fallbackError } = await supabase
      .from("kpi_values")
      .upsert(base, { onConflict: "kpi_id,hotel_id,fecha" });
    if (fallbackError) throw new Error(fallbackError.message);
    return;
  }
  if (error) throw new Error(error.message);
}

export async function loadKpiSqlData(
  kpiId: string,
  mode: LoadMode = "single",
  integrationId?: string | null
): Promise<SqlLoadResult> {
  const supabase = await createClient();
  const sourceDto = await getKpiSqlSource(kpiId);
  if (!sourceDto) throw new Error("Este KPI no tiene fuente SQL configurada");

  const { data: kpi } = await supabase
    .from("kpis")
    .select("id, codigo, hotel_id, region_id")
    .eq("id", kpiId)
    .single();
  if (!kpi) throw new Error("KPI no encontrado");

  const connection = await getDatabaseConnectionById(sourceDto.connection_id);
  if (!connection) throw new Error("Conexión no encontrada");

  const source: KpiSqlSourceRow = {
    kpi_id: kpiId,
    connection_id: sourceDto.connection_id,
    clause_select: sourceDto.clause_select,
    clause_from: sourceDto.clause_from,
    clause_where: sourceDto.clause_where,
    clause_group_by: sourceDto.clause_group_by,
    clause_having: sourceDto.clause_having,
    clause_order_by: sourceDto.clause_order_by,
    distinct_rows: sourceDto.distinct_rows,
    fecha_column: sourceDto.fecha_column ?? "fecha",
    hotel_column: sourceDto.hotel_column ?? null,
    variable_column_map: sourceDto.variable_column_map ?? {},
  };

  const formulaVariableCodes = await getRequiredInputVariableCodes(kpiId);
  const { sql, records } = await runKpiSqlSourceQuery(
    connection,
    source,
    kpi.codigo,
    formulaVariableCodes
  );

  const toProcess = mode === "single" ? records.slice(0, 1) : records;
  let loaded = 0;
  const errors: string[] = [];

  for (const rec of toProcess) {
    try {
      const rawInputs =
        rec.variables && Object.keys(rec.variables).length > 0
          ? rec.variables
          : rec.valor;
      const { valorReal, variableInputs } = await computeKpiValueFromInputs(kpiId, rawInputs);
      const hotelId =
        (await resolveHotelId(supabase, rec.hotel_codigo)) ?? kpi.hotel_id;

      await upsertSqlKpiValue(supabase, {
        kpi_id: kpiId,
        hotel_id: hotelId,
        region_id: kpi.region_id,
        fecha: rec.fecha,
        valor_real: valorReal,
        variable_inputs: variableInputs,
        integration_id: integrationId,
        fuente: integrationId ? "integracion" : "sql",
      });
      loaded++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Error al cargar fila");
    }
  }

  return {
    sql,
    loaded,
    errors,
    preview: toProcess[0],
    records: toProcess,
  };
}

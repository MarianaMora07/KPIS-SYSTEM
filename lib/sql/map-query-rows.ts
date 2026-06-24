import type { ExternalKpiRecord } from "@/modules/integraciones/adapters/types";

export interface KpiSqlSourceMapping {
  fecha_column: string;
  hotel_column?: string | null;
  variable_column_map: Record<string, string>;
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveColumnName(
  row: Record<string, unknown>,
  column: string
): unknown {
  if (column in row) return row[column];
  const lower = column.toLowerCase();
  const key = Object.keys(row).find((k) => k.toLowerCase() === lower);
  return key ? row[key] : undefined;
}

export function mapQueryRowsToKpiRecords(
  rows: Record<string, unknown>[],
  kpiCodigo: string,
  source: KpiSqlSourceMapping,
  formulaVariableCodes: string[] = []
): ExternalKpiRecord[] {
  const fechaCol = source.fecha_column || "fecha";
  const hotelCol = source.hotel_column?.trim() || null;
  const columnMap = source.variable_column_map ?? {};

  return rows.map((row) => {
    const fecha = normalizeDate(resolveColumnName(row, fechaCol));
    const hotelRaw = hotelCol ? resolveColumnName(row, hotelCol) : undefined;
    const hotel_codigo =
      hotelRaw != null && String(hotelRaw).trim() !== ""
        ? String(hotelRaw).trim()
        : undefined;

    const variables: Record<string, number> = {};
    const mappedEntries = Object.entries(columnMap);
    const entries =
      mappedEntries.length > 0
        ? mappedEntries.map(([sqlCol, varCode]) => [sqlCol, varCode] as const)
        : formulaVariableCodes.map((code) => [code, code] as const);

    for (const [sqlCol, varCode] of entries) {
      const num = toNumber(resolveColumnName(row, sqlCol));
      if (num !== null) {
        variables[varCode] = num;
      }
    }

    if (Object.keys(variables).length === 0) {
      for (const [key, val] of Object.entries(row)) {
        if (key === fechaCol || (hotelCol && key === hotelCol)) continue;
        const num = toNumber(val);
        if (num !== null) {
          variables[key] = num;
        }
      }
    }

    const scalar =
      Object.keys(variables).length === 1
        ? Object.values(variables)[0]!
        : Object.values(variables).reduce((a, b) => a + b, 0) / Math.max(Object.values(variables).length, 1);

    return {
      kpi_codigo: kpiCodigo,
      valor: scalar,
      fecha,
      ...(Object.keys(variables).length > 0 ? { variables } : {}),
      ...(hotel_codigo ? { hotel_codigo } : {}),
    };
  });
}

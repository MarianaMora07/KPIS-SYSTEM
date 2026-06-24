export const EXPECTED_COLUMNS = [
  "kpi_codigo",
  "fecha",
  "valor_real",
  "hotel_codigo",
] as const;

/** Columnas opcionales para KPIs con fórmula: var_{codigo_variable} */
export const VARIABLE_COLUMN_PREFIX = "var_";

export const OPTIONAL_IMPORT_COLUMNS = [
  "hotel_codigo",
  "var_visitas_mes",
  "var_reservas_web",
] as const;

export function formatExpectedColumnsHelp(): string {
  return [
    ...EXPECTED_COLUMNS,
    "...",
    "var_{codigo} (opcional, para KPIs con fórmula)",
  ].join(", ");
}

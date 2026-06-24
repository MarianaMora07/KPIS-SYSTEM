"use client";

import { useMemo } from "react";
import { buildStructuredSql, type SqlClauses } from "@/lib/sql/build-structured-query";

export interface StructuredSqlBuilderValue {
  clause_select: string;
  clause_from: string;
  clause_where: string;
  clause_group_by: string;
  clause_having: string;
  clause_order_by: string;
  distinct_rows: boolean;
  fecha_column: string;
  hotel_column: string;
  variable_column_map: Record<string, string>;
}

export const EMPTY_SQL_BUILDER_VALUE: StructuredSqlBuilderValue = {
  clause_select: "",
  clause_from: "",
  clause_where: "",
  clause_group_by: "",
  clause_having: "",
  clause_order_by: "",
  distinct_rows: false,
  fecha_column: "fecha",
  hotel_column: "",
  variable_column_map: {},
};

interface StructuredSqlBuilderProps {
  value: StructuredSqlBuilderValue;
  onChange: (value: StructuredSqlBuilderValue) => void;
  formulaVariableCodes?: string[];
  disabled?: boolean;
  /** Muestra solo cláusulas SQL, solo mapeo, o todo */
  section?: "query" | "mapping" | "all";
}

function ClauseField({
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-2 font-medium text-slate-700">
        {label}
        {required && <span className="text-amber-600">*</span>}
      </span>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 disabled:bg-slate-50"
      />
    </label>
  );
}

export function StructuredSqlBuilder({
  value,
  onChange,
  formulaVariableCodes = [],
  disabled = false,
  section = "all",
}: StructuredSqlBuilderProps) {
  const assembledSql = useMemo(() => {
    try {
      const clauses: SqlClauses = {
        select: value.clause_select,
        from: value.clause_from,
        where: value.clause_where || undefined,
        groupBy: value.clause_group_by || undefined,
        having: value.clause_having || undefined,
        orderBy: value.clause_order_by || undefined,
        distinct: value.distinct_rows,
      };
      if (!clauses.select.trim() || !clauses.from.trim()) return "";
      return buildStructuredSql(clauses);
    } catch {
      return "";
    }
  }, [value]);

  function patch(partial: Partial<StructuredSqlBuilderValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4">
      {(section === "all" || section === "query") && (
        <>
          <p className="text-sm text-slate-600">
            Arme la consulta por cláusulas. Las columnas del SELECT deben corresponder a las
            variables de la fórmula
            {formulaVariableCodes.length > 0 && (
              <span className="ml-1 font-mono text-xs text-amber-700">
                ({formulaVariableCodes.join(", ")})
              </span>
            )}
            . Las cláusulas vacías no se incluyen en el SQL final.
          </p>

          <div className="grid gap-3">
            <ClauseField
              label="SELECT"
              name="clause_select"
              value={value.clause_select}
              onChange={(v) => patch({ clause_select: v })}
              required
              placeholder="visitas_mes, reservas_web, periodo"
              disabled={disabled}
            />
            <ClauseField
              label="FROM"
              name="clause_from"
              value={value.clause_from}
              onChange={(v) => patch({ clause_from: v })}
              required
              placeholder="web_conversion_mensual"
              disabled={disabled}
            />
            <ClauseField
              label="WHERE"
              name="clause_where"
              value={value.clause_where}
              onChange={(v) => patch({ clause_where: v })}
              placeholder="hotel_codigo = 'CTG'"
              disabled={disabled}
            />
            <ClauseField
              label="GROUP BY"
              name="clause_group_by"
              value={value.clause_group_by}
              onChange={(v) => patch({ clause_group_by: v })}
              disabled={disabled}
            />
            <ClauseField
              label="HAVING"
              name="clause_having"
              value={value.clause_having}
              onChange={(v) => patch({ clause_having: v })}
              disabled={disabled}
            />
            <ClauseField
              label="ORDER BY"
              name="clause_order_by"
              value={value.clause_order_by}
              onChange={(v) => patch({ clause_order_by: v })}
              placeholder="periodo DESC"
              disabled={disabled}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={value.distinct_rows}
              onChange={(e) => patch({ distinct_rows: e.target.checked })}
              disabled={disabled}
            />
            DISTINCT
          </label>
        </>
      )}

      {(section === "all" || section === "mapping") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ClauseField
            label="Columna fecha"
            name="fecha_column"
            value={value.fecha_column}
            onChange={(v) => patch({ fecha_column: v })}
            placeholder="fecha"
            disabled={disabled}
          />
          <ClauseField
            label="Columna hotel (opcional)"
            name="hotel_column"
            value={value.hotel_column}
            onChange={(v) => patch({ hotel_column: v })}
            placeholder="hotel_codigo"
            disabled={disabled}
          />
        </div>
      )}

      {(section === "all" || section === "query") && assembledSql && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Vista previa SQL
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-800">
            {assembledSql}
          </pre>
        </div>
      )}
    </div>
  );
}

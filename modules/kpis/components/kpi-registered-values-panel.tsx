"use client";

import { useMemo, useState } from "react";
import { usePermissions } from "@/components/layout/permissions-context";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatKpiValue } from "@/modules/dashboard/types";
import type { KpiValueRow } from "./kpi-values-analytics-panel";

const PAGE_SIZE = 10;

interface KpiRegisteredValuesPanelProps {
  values: KpiValueRow[];
  unidadMedida: string;
  pending?: boolean;
  onDelete: (value: KpiValueRow) => void;
}

export function KpiRegisteredValuesPanel({
  values,
  unidadMedida,
  pending = false,
  onDelete,
}: KpiRegisteredValuesPanelProps) {
  const { canManageUsers } = usePermissions();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(0);

  const filteredValues = useMemo(() => {
    return values.filter((v) => {
      if (fechaDesde && v.fecha < fechaDesde) return false;
      if (fechaHasta && v.fecha > fechaHasta) return false;
      return true;
    });
  }, [values, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(filteredValues.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageValues = filteredValues.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Valores registrados
        </h2>
        {values.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button
              type="button"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
                setPage(0);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Limpiar
            </button>
          )}
          </div>
        )}
      </div>

      <ul className="space-y-2 text-sm">
        {pageValues.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2"
          >
            <span className="text-slate-600">{v.fecha}</span>
            <span className="font-medium">
              {formatKpiValue(Number(v.valor_real), unidadMedida)}
            </span>
            <span className="text-slate-500">
              {v.cumplimiento_pct != null ? `${v.cumplimiento_pct}%` : "—"}
            </span>
            {v.scope_label && (
              <span className="w-full text-xs text-slate-400">{v.scope_label}</span>
            )}
            {v.variable_inputs && Object.keys(v.variable_inputs).length > 0 && (
              <span className="w-full text-xs text-slate-400">
                Entradas:{" "}
                {Object.entries(v.variable_inputs)
                  .map(([k, val]) => `${k}=${val}`)
                  .join(", ")}
              </span>
            )}
            {canManageUsers && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onDelete(v)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Eliminar
              </button>
            )}
          </li>
        ))}
        {filteredValues.length === 0 && (
          <li className="text-slate-500">
            {values.length === 0
              ? "Sin valores registrados."
              : "No hay valores en el rango de fechas seleccionado."}
          </li>
        )}
      </ul>

      <PaginationControls
        page={safePage}
        totalPages={totalPages}
        totalItems={filteredValues.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="valores"
      />
    </section>
  );
}

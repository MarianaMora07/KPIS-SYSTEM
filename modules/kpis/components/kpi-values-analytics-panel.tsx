"use client";

import { useMemo, useState } from "react";
import { TrendsLineChart } from "@/modules/dashboard/components/trends-line-chart";
import { VarianceBarChart } from "@/modules/dashboard/components/variance-bar-chart";
import { ComparativesChart } from "@/modules/dashboard/components/comparatives-chart";
import {
  formatKpiValue,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import type { TrafficLightStatus } from "@/types/database";
import { getValueOptionsForKpi } from "@/modules/dashboard/utils/chart-data";

export interface KpiValueRow {
  id: string;
  fecha: string;
  valor_real: number;
  valor_meta: number | null;
  cumplimiento_pct: number | null;
  semaforo?: TrafficLightStatus | null;
}

interface KpiValuesAnalyticsPanelProps {
  kpiId: string;
  kpiCodigo: string;
  kpiNombre: string;
  unidadMedida: string;
  values: KpiValueRow[];
  initialSelectedFecha?: string;
}

export function KpiValuesAnalyticsPanel({
  kpiId,
  kpiCodigo,
  kpiNombre,
  unidadMedida,
  values,
  initialSelectedFecha,
}: KpiValuesAnalyticsPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string>(
    initialSelectedFecha
      ? values.find((v) => v.fecha === initialSelectedFecha)?.id ?? "all"
      : "all"
  );
  const [compareMode, setCompareMode] = useState<"month" | "year">("month");

  const history = useMemo(
    () => valuesToDashboardRows(kpiId, kpiCodigo, kpiNombre, unidadMedida, values),
    [kpiId, kpiCodigo, kpiNombre, unidadMedida, values]
  );

  const valueOptions = useMemo(
    () => getValueOptionsForKpi(history, kpiId),
    [history, kpiId]
  );

  const latestRow = valueOptions[0]?.row ?? null;
  const focusedRow =
    selectedKey === "all"
      ? null
      : valueOptions.find((v) => v.id === selectedKey)?.row ?? null;
  const displayRow = focusedRow ?? latestRow;

  return (
    <section className="glass space-y-6 rounded-xl border border-slate-200/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Gráficas y estadísticas
        </h2>
        <select
          aria-label="Valor registrado para análisis"
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            selectedKey !== "all"
              ? "border-amber-400 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-white"
          }`}
        >
          <option value="all">Todos los registros</option>
          {valueOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} —{" "}
              {formatKpiValue(Number(opt.row.valor_real), unidadMedida)}
            </option>
          ))}
        </select>
      </div>

      {focusedRow && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
            Registro en foco
          </p>
          <p className="mt-1 text-sm text-amber-950">
            {focusedRow.fecha} —{" "}
            <strong>
              {formatKpiValue(Number(focusedRow.valor_real), unidadMedida)}
            </strong>
          </p>
        </div>
      )}

      {(displayRow || values.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard
            label={focusedRow ? "Valor seleccionado" : "Último valor"}
            value={formatKpiValue(
              Number(displayRow?.valor_real ?? 0),
              unidadMedida
            )}
          />
          <StatCard
            label="Meta"
            value={
              displayRow?.valor_meta != null
                ? formatKpiValue(Number(displayRow.valor_meta), unidadMedida)
                : "—"
            }
          />
          <StatCard
            label="Cumplimiento"
            value={
              displayRow?.cumplimiento_pct != null
                ? `${displayRow.cumplimiento_pct}%`
                : "—"
            }
          />
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Semáforo</p>
            {displayRow?.semaforo_calculado ? (
              <TrafficLightGlow
                status={displayRow.semaforo_calculado}
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm font-medium text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {values.length === 0 && (
        <p className="text-sm text-slate-500">
          Registre valores para ver tendencias y comparativos.
        </p>
      )}

      {history.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
              Tendencias
              {focusedRow && (
                <span className="ml-2 normal-case text-amber-600">
                  (hasta {focusedRow.fecha})
                </span>
              )}
            </h3>
            <TrendsLineChart
              history={history}
              kpiId={kpiId}
              unidadMedida={unidadMedida}
              showProjection={selectedKey === "all"}
              highlightFecha={focusedRow?.fecha}
              highlightHotel={focusedRow?.hotel_nombre ?? undefined}
            />
          </div>
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
              {focusedRow
                ? `Meta vs. real · ${focusedRow.fecha}`
                : "Meta vs. real"}
            </h3>
            <VarianceBarChart
              history={history}
              kpiId={kpiId}
              unidadMedida={unidadMedida}
              focusFecha={focusedRow?.fecha}
            />
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {focusedRow ? "Comparativo vs. registro anterior" : "Comparativo"}
            </h3>
            {!focusedRow && (
              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as "month" | "year")}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="month">Mes vs mes</option>
                <option value="year">Año vs año</option>
              </select>
            )}
          </div>
          <ComparativesChart
            history={history}
            kpiId={kpiId}
            unidadMedida={unidadMedida}
            mode={compareMode}
            focusRowId={focusedRow?.id}
          />
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-imperial-900">{value}</p>
    </div>
  );
}

function valuesToDashboardRows(
  kpiId: string,
  kpiCodigo: string,
  kpiNombre: string,
  unidadMedida: string,
  values: KpiValueRow[]
): DashboardKpiRow[] {
  return [...values]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((v) => ({
      id: v.id,
      kpi_id: kpiId,
      kpi_nombre: kpiNombre,
      kpi_codigo: kpiCodigo,
      unidad_medida: unidadMedida,
      hotel_id: null,
      hotel_nombre: "General",
      region_id: null,
      region_nombre: null,
      fecha: v.fecha,
      valor_real: Number(v.valor_real),
      valor_meta: v.valor_meta != null ? Number(v.valor_meta) : null,
      cumplimiento_pct: v.cumplimiento_pct,
      semaforo_calculado: v.semaforo ?? null,
      fuente: "manual",
    }));
}

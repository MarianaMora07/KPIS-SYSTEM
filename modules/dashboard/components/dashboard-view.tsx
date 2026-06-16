"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import { TrendsLineChart } from "@/modules/dashboard/components/trends-line-chart";
import { VarianceBarChart } from "@/modules/dashboard/components/variance-bar-chart";
import { ComparativesChart } from "@/modules/dashboard/components/comparatives-chart";
import { CriticalIndicatorsPanel } from "@/modules/dashboard/components/critical-indicators-panel";
import {
  formatKpiValue,
  formatVariacion,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";
import { getKpiOptions } from "@/modules/dashboard/utils/chart-data";
import type { TrafficLightStatus } from "@/types/database";

interface DashboardViewProps {
  kpiCards: DashboardKpiRow[];
  worstPerformers: DashboardKpiRow[];
  history: DashboardKpiRow[];
  isDemo?: boolean;
}

export function DashboardView({
  kpiCards,
  worstPerformers,
  history,
  isDemo,
}: DashboardViewProps) {
  const kpiOptions = useMemo(() => getKpiOptions(kpiCards), [kpiCards]);
  const [selectedKpiId, setSelectedKpiId] = useState(
    () => kpiOptions[0]?.id ?? ""
  );
  const [selected, setSelected] = useState<DashboardKpiRow | null>(null);
  const [compareMode, setCompareMode] = useState<"month" | "year">("month");

  const activeKpiId = selectedKpiId || kpiOptions[0]?.id || "";
  const activeKpi =
    kpiCards.find((k) => k.kpi_id === activeKpiId) ??
    history.find((h) => h.kpi_id === activeKpiId);

  const drillHistory = selected
    ? history.filter((h) => h.kpi_id === selected.kpi_id)
    : [];

  function handleKpiCardClick(kpi: DashboardKpiRow) {
    setSelectedKpiId(kpi.kpi_id);
    setSelected(kpi);
  }

  return (
    <div className="space-y-8">
      {isDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Modo demo: conecte Supabase en <code>.env.local</code> para datos en
          vivo.{" "}
          <a href="/login" className="underline">
            Inicie sesión
          </a>{" "}
          para operaciones con RLS.
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          KPIs principales
        </h2>
        {kpiCards.length === 0 ? (
          <div className="glass rounded-xl border border-dashed border-slate-200 p-12 text-center">
            <p className="text-sm text-slate-500">
              No hay datos para los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi, index) => (
              <KpiCard
                key={kpi.kpi_id}
                nombre={kpi.kpi_nombre}
                valor={formatKpiValue(Number(kpi.valor_real), kpi.unidad_medida)}
                meta={
                  kpi.valor_meta != null
                    ? formatKpiValue(Number(kpi.valor_meta), kpi.unidad_medida)
                    : undefined
                }
                variacion={formatVariacion(
                  Number(kpi.valor_real),
                  kpi.valor_meta != null ? Number(kpi.valor_meta) : null,
                  kpi.unidad_medida
                )}
                semaforo={
                  (kpi.semaforo_calculado ?? "riesgo") as TrafficLightStatus
                }
                index={index}
                onClick={() => handleKpiCardClick(kpi)}
              />
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="glass space-y-6 rounded-xl border border-slate-200/60 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
              Análisis visual
            </h2>
            {kpiOptions.length > 1 && (
              <select
                aria-label="KPI para gráficos"
                value={activeKpiId}
                onChange={(e) => setSelectedKpiId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm text-imperial-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {kpiOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                Tendencias históricas
              </h3>
              {activeKpi ? (
                <TrendsLineChart
                  history={history}
                  kpiId={activeKpiId}
                  unidadMedida={activeKpi.unidad_medida}
                  showProjection
                />
              ) : (
                <EmptyChart message="Seleccione un KPI para ver tendencias" />
              )}
            </div>
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                Meta vs. real por hotel
              </h3>
              {activeKpi ? (
                <VarianceBarChart
                  history={history}
                  kpiId={activeKpiId}
                  unidadMedida={activeKpi.unidad_medida}
                />
              ) : (
                <EmptyChart message="Seleccione un KPI para comparar metas" />
              )}
            </div>
          </div>

          {activeKpi && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Comparativo
                </h3>
                <select
                  value={compareMode}
                  onChange={(e) => setCompareMode(e.target.value as "month" | "year")}
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="month">Mes vs mes</option>
                  <option value="year">Año vs año</option>
                </select>
              </div>
              <ComparativesChart
                history={history}
                kpiId={activeKpiId}
                unidadMedida={activeKpi.unidad_medida}
                mode={compareMode}
              />
            </div>
          )}
        </div>

        <CriticalIndicatorsPanel items={worstPerformers} />
      </motion.section>

      <AnimatePresence>
        {selected && (
          <DrillDownModal
            kpi={selected}
            history={drillHistory}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function DrillDownModal({
  kpi,
  history,
  onClose,
}: {
  kpi: DashboardKpiRow;
  history: DashboardKpiRow[];
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-imperial-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200/60 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-amber-600">{kpi.kpi_codigo}</p>
            <h3 className="text-xl font-semibold text-imperial-900">
              {kpi.kpi_nombre}
            </h3>
            <p className="text-sm text-slate-500">
              {kpi.hotel_nombre} · {kpi.region_nombre}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <p className="text-3xl font-semibold text-imperial-900">
            {formatKpiValue(Number(kpi.valor_real), kpi.unidad_medida)}
          </p>
          {kpi.semaforo_calculado && (
            <TrafficLightGlow status={kpi.semaforo_calculado} />
          )}
        </div>

        {kpi.cumplimiento_pct != null && (
          <p className="mb-4 text-sm text-slate-600">
            Cumplimiento: {kpi.cumplimiento_pct}%
            {kpi.valor_meta != null &&
              ` · Meta: ${formatKpiValue(Number(kpi.valor_meta), kpi.unidad_medida)}`}
          </p>
        )}

        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Histórico
        </h4>
        <div className="mb-4 h-40">
          <TrendsLineChart
            history={history}
            kpiId={kpi.kpi_id}
            unidadMedida={kpi.unidad_medida}
            compact
          />
        </div>
        <ul className="space-y-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="text-slate-600">{h.fecha}</span>
              <span className="font-medium">
                {formatKpiValue(Number(h.valor_real), h.unidad_medida)}
              </span>
              {h.semaforo_calculado && (
                <TrafficLightGlow
                  status={h.semaforo_calculado}
                  showLabel={false}
                />
              )}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

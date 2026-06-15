"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import {
  formatKpiValue,
  formatVariacion,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";
import type { TrafficLightStatus } from "@/types/database";

interface DashboardViewProps {
  kpiCards: DashboardKpiRow[];
  criticalKpis: DashboardKpiRow[];
  history: DashboardKpiRow[];
  isDemo?: boolean;
}

export function DashboardView({
  kpiCards,
  criticalKpis,
  history,
  isDemo,
}: DashboardViewProps) {
  const [selected, setSelected] = useState<DashboardKpiRow | null>(null);
  const drillHistory = selected
    ? history.filter((h) => h.kpi_id === selected.kpi_id)
    : [];

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

      {criticalKpis.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-red-500">
            Indicadores críticos
          </h2>
          <div className="flex flex-wrap gap-3">
            {criticalKpis.map((k) => (
              <button
                key={k.kpi_id}
                type="button"
                onClick={() => setSelected(k)}
                className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-red-100"
              >
                {k.kpi_nombre} —{" "}
                {formatKpiValue(Number(k.valor_real), k.unidad_medida)}
              </button>
            ))}
          </div>
        </motion.section>
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
                onClick={() => setSelected(kpi)}
              />
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="glass rounded-xl border border-slate-200/60 p-6"
      >
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Tendencias recientes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="pb-2 pr-4">KPI</th>
                <th className="pb-2 pr-4">Hotel</th>
                <th className="pb-2 pr-4">Fecha</th>
                <th className="pb-2 pr-4">Valor</th>
                <th className="pb-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 cursor-pointer hover:bg-amber-500/5"
                  onClick={() => setSelected(row)}
                >
                  <td className="py-2 pr-4 font-medium text-imperial-900">
                    {row.kpi_nombre}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {row.hotel_nombre ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{row.fecha}</td>
                  <td className="py-2 pr-4">
                    {formatKpiValue(Number(row.valor_real), row.unidad_medida)}
                  </td>
                  <td className="py-2">
                    {row.semaforo_calculado && (
                      <TrafficLightGlow
                        status={row.semaforo_calculado}
                        showLabel={false}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

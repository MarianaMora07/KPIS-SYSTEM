"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import { formatKpiValue } from "@/modules/dashboard/types";
import type { MetasDashboardRow } from "@/modules/metas/types";
import type { TrafficLightStatus } from "@/types/database";
import { TargetExpiredBadge } from "./target-expired-badge";

interface MetasDashboardPanelProps {
  rows: MetasDashboardRow[];
}

const PERIODO_LABELS: Record<string, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  especial: "Especial",
};

const PAGE_SIZE = 5;

function scopeLabel(row: MetasDashboardRow): string {
  if (row.hotel_nombre) return row.hotel_nombre;
  if (row.region_nombre) return row.region_nombre;
  return "Global";
}

export function MetasDashboardPanel({ rows }: MetasDashboardPanelProps) {
  const { can } = usePermissions();
  const canConfigure = can("metas.configurar");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const summary = useMemo(() => {
    const total = rows.length;
    const cumplimiento = rows.filter((r) => r.semaforo === "cumplimiento").length;
    const riesgo = rows.filter((r) => r.semaforo === "riesgo").length;
    const sinDatos = rows.filter((r) => r.valor_real == null).length;
    const vencidas = rows.filter((r) => r.vencida).length;
    return { total, cumplimiento, riesgo, sinDatos, vencidas };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Metas en filtro" value={summary.total} />
        <SummaryCard label="En cumplimiento" value={summary.cumplimiento} accent="green" />
        <SummaryCard label="En riesgo" value={summary.riesgo} accent="amber" />
        <SummaryCard label="Sin datos aún" value={summary.sinDatos} accent="slate" />
        <SummaryCard label="Vencidas" value={summary.vencidas} accent="slate" />
      </div>

      <section className="glass overflow-hidden rounded-xl border border-slate-200/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">KPI</th>
                <th className="px-4 py-3 font-medium">Periodo</th>
                <th className="px-4 py-3 font-medium">Alcance</th>
                <th className="px-4 py-3 font-medium text-right">Meta</th>
                <th className="px-4 py-3 font-medium text-right">Avance</th>
                <th className="px-4 py-3 font-medium text-right">Cumplimiento</th>
                <th className="px-4 py-3 font-medium text-center">Semáforo</th>
                {canConfigure && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/kpis/${row.kpi_id}?tab=metas`}
                      className="font-medium text-imperial-900 hover:text-amber-700"
                    >
                      <span className="font-mono text-xs text-amber-600">{row.kpi_codigo}</span>
                      <span className="mt-0.5 block text-slate-700">{row.kpi_nombre}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="block capitalize">
                      {PERIODO_LABELS[row.periodo_tipo] ?? row.periodo_tipo}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>
                        {row.fecha_inicio} — {row.fecha_fin}
                      </span>
                      <TargetExpiredBadge fechaFin={row.fecha_fin} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{scopeLabel(row)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatKpiValue(row.valor_meta, row.unidad_medida)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.valor_real != null ? (
                      formatKpiValue(row.valor_real, row.unidad_medida)
                    ) : (
                      <span className="text-slate-400">Sin datos</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.cumplimiento_pct != null ? (
                      `${row.cumplimiento_pct}%`
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.semaforo ? (
                      <TrafficLightGlow
                        status={row.semaforo as TrafficLightStatus}
                        showLabel={false}
                        className="px-2 py-0.5"
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {canConfigure && (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/kpis/${row.kpi_id}?tab=metas`}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Configurar
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={canConfigure ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No hay metas en el periodo o filtros seleccionados. Cree metas en el detalle
                    de cada KPI.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 pb-4">
          <PaginationControls
            page={safePage}
            totalPages={totalPages}
            totalItems={rows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="metas"
          />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: "default" | "green" | "amber" | "slate";
}) {
  const valueClass =
    accent === "green"
      ? "text-green-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "slate"
          ? "text-slate-500"
          : "text-imperial-900";

  return (
    <div className="glass rounded-xl border border-slate-200/60 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

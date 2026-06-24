"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExportReportButton } from "@/modules/dashboard/components/export-report-button";
import {
  formatKpiValue,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import type { TrafficLightStatus } from "@/types/database";
import { DEMO_DASHBOARD_DATA, filterDemoData } from "@/modules/dashboard/data/demo-data";
import { ScheduledReportsPanel } from "./scheduled-reports-panel";
import type { ScheduledReportRow } from "../services/scheduled-reports-service";
import { usePermissions } from "@/components/layout/permissions-context";

export function ReportesView({
  isDemo,
  schedules = [],
  regions = [],
  hotels = [],
}: {
  isDemo?: boolean;
  schedules?: ScheduledReportRow[];
  regions?: { id: string; nombre: string }[];
  hotels?: { id: string; nombre: string }[];
}) {
  const { can } = usePermissions();
  const canExport = can("reportes.exportar");
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<DashboardKpiRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (res.ok) {
        setRows(await res.json());
      } else {
        setRows(
          filterDemoData(DEMO_DASHBOARD_DATA, {
            regionId: params.get("region") ?? undefined,
            hotelId: params.get("hotel") ?? undefined,
            fechaDesde: params.get("desde") ?? "2026-06-01",
            fechaHasta: params.get("hasta") ?? "2026-06-30",
          })
        );
      }
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Vista previa"}
        </button>
        <ExportReportButton disabled={!canExport} regions={regions} hotels={hotels} />
      </div>

      {!canExport && (
        <p className="text-sm text-amber-700">
          No tiene permiso para exportar reportes.
        </p>
      )}

      {!isDemo && <ScheduledReportsPanel schedules={schedules} />}

      {isDemo && (
        <p className="text-sm text-amber-700">
          Modo demo: la vista previa usa datos de ejemplo.
        </p>
      )}

      {loaded && (
        <div className="glass overflow-hidden rounded-xl border border-slate-200/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">KPI</th>
                <th className="px-4 py-3">Hotel</th>
                <th className="px-4 py-3">Real</th>
                <th className="px-4 py-3">Meta</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">{r.kpi_nombre}</td>
                  <td className="px-4 py-2">{r.hotel_nombre ?? "—"}</td>
                  <td className="px-4 py-2">
                    {formatKpiValue(Number(r.valor_real), r.unidad_medida)}
                  </td>
                  <td className="px-4 py-2">
                    {r.valor_meta != null
                      ? formatKpiValue(Number(r.valor_meta), r.unidad_medida)
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.semaforo_calculado && (
                      <TrafficLightGlow
                        status={r.semaforo_calculado as TrafficLightStatus}
                        showLabel={false}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <p className="px-4 py-2 text-xs text-slate-500">
              Mostrando 20 de {rows.length} registros
            </p>
          )}
        </div>
      )}
    </div>
  );
}

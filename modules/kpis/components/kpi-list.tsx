"use client";

import { useTransition } from "react";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import { inactivateKpiAction } from "@/modules/kpis/actions/kpi-actions";
import type { TrafficLightStatus } from "@/types/database";

interface KpiRow {
  id: string;
  codigo: string;
  nombre: string;
  area_responsable: string;
  frecuencia: string;
  unidad_medida: string;
  meta: number | null;
  tipo_indicador: string;
  estado: string;
  kpi_categories: { nombre: string } | null;
}

interface KpiListProps {
  kpis: KpiRow[];
}

export function KpiList({ kpis }: KpiListProps) {
  const [pending, startTransition] = useTransition();

  if (kpis.length === 0) {
    return (
      <div className="glass rounded-xl border border-dashed border-slate-200 p-12 text-center">
        <p className="text-sm text-slate-500">
          No hay KPIs activos. Use &quot;Crear KPI&quot; para comenzar.
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-xl border border-slate-200/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3">Área</th>
            <th className="px-4 py-3">Frecuencia</th>
            <th className="px-4 py-3">Meta</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi) => (
            <tr
              key={kpi.id}
              className="border-b border-slate-100 transition-colors hover:bg-amber-500/5"
            >
              <td className="px-4 py-3 font-mono text-xs text-amber-700">
                {kpi.codigo}
              </td>
              <td className="px-4 py-3 font-medium text-imperial-900">
                {kpi.nombre}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {kpi.kpi_categories?.nombre ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-600">{kpi.area_responsable}</td>
              <td className="px-4 py-3 capitalize text-slate-600">
                {kpi.frecuencia}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {kpi.meta != null ? `${kpi.meta} ${kpi.unidad_medida}` : "—"}
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">
                {kpi.tipo_indicador}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      if (confirm(`¿Inactivar KPI ${kpi.codigo}?`)) {
                        await inactivateKpiAction(kpi.id);
                      }
                    })
                  }
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Inactivar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiStatusBadge({ status }: { status: TrafficLightStatus }) {
  return <TrafficLightGlow status={status} />;
}

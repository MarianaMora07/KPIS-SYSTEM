"use client";

import { usePermissions } from "@/components/layout/permissions-context";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardList } from "lucide-react";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import {
  formatKpiValue,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";
import type { TrafficLightStatus } from "@/types/database";

interface CriticalIndicatorsPanelProps {
  items: DashboardKpiRow[];
}

export function CriticalIndicatorsPanel({ items }: CriticalIndicatorsPanelProps) {
  const { can } = usePermissions();
  const canViewAlerts = can("alertas.ver");

  return (
    <aside className="glass flex h-full flex-col rounded-xl border border-red-200/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-red-500">
          Top indicadores críticos
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay hoteles en estado de riesgo o incumplimiento.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-3">
          {items.map((item) => (
            <li key={`${item.kpi_id}-${item.hotel_id}`}>
              <CriticalItem item={item} />
            </li>
          ))}
        </ul>
      )}

      {canViewAlerts && (
        <Link
          href="/alertas"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-amber-500/40 hover:bg-amber-50 hover:text-imperial-900"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Ver todas las alertas
        </Link>
      )}
    </aside>
  );
}

function CriticalItem({ item }: { item: DashboardKpiRow }) {
  const { can } = usePermissions();
  const canManagePlans = can("planes.gestionar");
  const href = canManagePlans
    ? buildActionPlanUrl(item)
    : `/kpis/${item.kpi_id}`;
  const status = (item.semaforo_calculado ?? "riesgo") as TrafficLightStatus;

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/50 p-3 transition-colors hover:border-red-200 hover:bg-red-50"
    >
      <TrafficLightGlow status={status} showLabel={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-imperial-900">
          {item.kpi_nombre}
        </p>
        <p className="truncate text-xs text-slate-500">
          {item.hotel_nombre}
        </p>
        <p className="mt-1 text-xs font-medium text-red-600">
          {formatKpiValue(Number(item.valor_real), item.unidad_medida)}
          {item.cumplimiento_pct != null && (
            <span className="ml-1 font-normal text-slate-500">
              ({item.cumplimiento_pct}% meta)
            </span>
          )}
        </p>
        {canManagePlans && (
          <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">
            Registrar plan de acción
            <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Link>
  );
}

function buildActionPlanUrl(item: DashboardKpiRow): string {
  const params = new URLSearchParams({
    accion: "plan",
    kpi_id: item.kpi_id,
    kpi: item.kpi_nombre,
  });
  if (item.hotel_id) params.set("hotel_id", item.hotel_id);
  if (item.hotel_nombre) params.set("hotel", item.hotel_nombre);
  return `/alertas?${params.toString()}`;
}

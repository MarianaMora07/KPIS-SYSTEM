"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import { formatKpiValue } from "@/modules/dashboard/types";
import { buildComparativeSeries, buildComparativeForRow } from "@/modules/dashboard/utils/chart-data";

interface ComparativesChartProps {
  history: DashboardKpiRow[];
  kpiId: string;
  unidadMedida: string;
  mode?: "month" | "year";
  focusRowId?: string;
}

export function ComparativesChart({
  history,
  kpiId,
  unidadMedida,
  mode = "month",
  focusRowId,
}: ComparativesChartProps) {
  const data = focusRowId
    ? buildComparativeForRow(history, focusRowId)
    : buildComparativeSeries(history, kpiId, mode);

  if (data.length === 0 || (data[0].actual === 0 && data[0].anterior === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-500">
        Sin datos para comparativo
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(v) => formatKpiValue(Number(v), unidadMedida)}
        />
        <Tooltip
          formatter={(value) => formatKpiValue(Number(value), unidadMedida)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="anterior" name="Periodo anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Periodo actual" fill="#d4af37" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

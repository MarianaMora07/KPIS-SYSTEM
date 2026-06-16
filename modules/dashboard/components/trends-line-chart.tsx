"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import { formatKpiValue } from "@/modules/dashboard/types";
import { buildTrendSeries, buildProjectionSeries } from "@/modules/dashboard/utils/chart-data";

interface TrendsLineChartProps {
  history: DashboardKpiRow[];
  kpiId: string;
  unidadMedida: string;
  showProjection?: boolean;
  compact?: boolean;
}

export function TrendsLineChart({
  history,
  kpiId,
  unidadMedida,
  showProjection = false,
  compact = false,
}: TrendsLineChartProps) {
  const { data, series } = showProjection
    ? { data: buildProjectionSeries(history, kpiId).data, series: [{ key: "real", label: "Real", color: "#d4af37" }, { key: "proyeccion", label: "Proyección (est.)", color: "#94a3b8" }] }
    : buildTrendSeries(history, kpiId);

  const height = compact ? 160 : 280;

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Sin datos históricos para este KPI
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickFormatter={(v) => formatAxisValue(Number(v), unidadMedida)}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
          formatter={(value) =>
            formatKpiValue(Number(value), unidadMedida)
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.key === "proyeccion" ? "5 5" : undefined}
            dot={{ r: 3, fill: s.color }}
            activeDot={{ r: 5 }}
            connectNulls={s.key === "proyeccion"}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatAxisValue(value: number, unidad: string): string {
  if (unidad === "COP") {
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return String(value);
  }
  if (unidad === "%") return `${value}%`;
  return String(value);
}

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
  ReferenceLine,
} from "recharts";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import { formatKpiValue } from "@/modules/dashboard/types";
import {
  buildTrendSeries,
  buildProjectionSeries,
  formatChartDateLabel,
} from "@/modules/dashboard/utils/chart-data";

interface TrendsLineChartProps {
  history: DashboardKpiRow[];
  kpiId: string;
  unidadMedida: string;
  showProjection?: boolean;
  compact?: boolean;
  /** ISO fecha (YYYY-MM-DD) del registro enfocado */
  highlightFecha?: string;
  /** Serie/hotel a resaltar cuando hay varios */
  highlightHotel?: string;
}

export function TrendsLineChart({
  history,
  kpiId,
  unidadMedida,
  showProjection = false,
  compact = false,
  highlightFecha,
  highlightHotel,
}: TrendsLineChartProps) {
  const focusMode = Boolean(highlightFecha);
  const highlightLabel = highlightFecha
    ? formatChartDateLabel(highlightFecha)
    : undefined;

  const filteredHistory =
    focusMode && highlightFecha
      ? history.filter(
          (r) =>
            r.kpi_id === kpiId &&
            r.fecha <= highlightFecha
        )
      : history;

  const { data, series } = showProjection && !focusMode
    ? {
        data: buildProjectionSeries(filteredHistory, kpiId).data,
        series: [
          { key: "real", label: "Real", color: "#d4af37" },
          { key: "proyeccion", label: "Proyección (est.)", color: "#94a3b8" },
        ],
      }
    : buildTrendSeries(filteredHistory, kpiId);

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
        {highlightLabel && (
          <ReferenceLine
            x={highlightLabel}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 4"
            label={{
              value: "Registro seleccionado",
              position: "top",
              fill: "#b45309",
              fontSize: 10,
            }}
          />
        )}
        {series.map((s) => {
          const isFocusedSeries =
            !focusMode ||
            !highlightHotel ||
            s.key === highlightHotel ||
            series.length === 1;

          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={isFocusedSeries ? (focusMode ? 3 : 2) : 1}
              strokeOpacity={isFocusedSeries ? 1 : 0.25}
              strokeDasharray={s.key === "proyeccion" ? "5 5" : undefined}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return <g />;
                const isHighlightPoint =
                  highlightLabel &&
                  payload.fecha === highlightLabel &&
                  (!highlightHotel || s.key === highlightHotel);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHighlightPoint ? 8 : isFocusedSeries ? 4 : 2}
                    fill={isHighlightPoint ? "#f59e0b" : s.color}
                    stroke={isHighlightPoint ? "#fff" : "none"}
                    strokeWidth={isHighlightPoint ? 2 : 0}
                  />
                );
              }}
              activeDot={{ r: focusMode ? 8 : 5 }}
              connectNulls={s.key === "proyeccion"}
            />
          );
        })}
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

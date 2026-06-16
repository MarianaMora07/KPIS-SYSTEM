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
import { buildVarianceData } from "@/modules/dashboard/utils/chart-data";

interface VarianceBarChartProps {
  history: DashboardKpiRow[];
  kpiId: string;
  unidadMedida: string;
}

export function VarianceBarChart({
  history,
  kpiId,
  unidadMedida,
}: VarianceBarChartProps) {
  const raw = buildVarianceData(history, kpiId);
  const data = raw.map((d) => ({
    hotel: shortenHotel(d.hotel),
    Real: d.real,
    Meta: d.meta ?? 0,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Sin datos de comparación meta vs. real
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="hotel"
          tick={{ fontSize: 10, fill: "#64748b" }}
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
          formatter={(value, name) => [
            formatKpiValue(Number(value), unidadMedida),
            name === "Real" ? "Real" : "Meta",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="square"
          iconSize={10}
        />
        <Bar dataKey="Real" fill="#d4af37" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="Meta" fill="#0a192f" radius={[4, 4, 0, 0]} maxBarSize={36} opacity={0.75} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function shortenHotel(name: string): string {
  return name.replace("Estelar ", "");
}

function formatAxisValue(value: number, unidad: string): string {
  if (unidad === "COP") {
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return String(value);
  }
  if (unidad === "%") return `${value}%`;
  return String(value);
}

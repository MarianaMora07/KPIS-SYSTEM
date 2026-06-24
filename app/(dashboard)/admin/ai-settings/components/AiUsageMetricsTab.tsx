"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AlertTriangle, DollarSign, Zap, TrendingUp } from "lucide-react";
import type { AiUsageMetrics } from "../actions/ai-settings-actions";

interface AiUsageMetricsTabProps {
  metrics: AiUsageMetrics;
}

// Costo estimado por 1M tokens (Gemini 2.5 Flash Lite ~$0.075)
const COST_PER_MILLION = 0.075;

const MODULE_LABELS: Record<string, string> = {
  generacion_planes_accion: "Planes de Acción",
  sugerencias_kpis: "Sugerencias KPIs",
  alertas_ia: "Alertas IA",
  reportes_ia: "Reportes IA",
  analisis_tendencias: "Análisis Tendencias",
};

const PALETTE = [
  "#0b3061",
  "#1d6fa4",
  "#d4af37",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
];

export function AiUsageMetricsTab({ metrics }: AiUsageMetricsTabProps) {
  const { daily, byModule, quotas } = metrics;

  const totalTokens = useMemo(
    () => daily.reduce((s, d) => s + d.total_tokens, 0),
    [daily]
  );

  const estimatedCost = useMemo(
    () => (totalTokens / 1_000_000) * COST_PER_MILLION,
    [totalTokens]
  );

  const chartData = useMemo(
    () =>
      daily.map((d) => ({
        fecha: formatDate(d.fecha),
        tokens: d.total_tokens,
      })),
    [daily]
  );

  const donutData = useMemo(
    () =>
      byModule.map((m) => ({
        name: MODULE_LABELS[m.modulo_origen] ?? m.modulo_origen,
        value: m.total_tokens,
      })),
    [byModule]
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Zap className="h-5 w-5 text-imperial-900" />}
          label="Total Tokens (30 días)"
          value={totalTokens.toLocaleString()}
          sub="tokens consumidos"
          color="imperial"
        />
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          label="Costo Estimado"
          value={`$${estimatedCost.toFixed(4)}`}
          sub={`a $${COST_PER_MILLION}/1M tokens (Gemini Flash)`}
          color="emerald"
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
          label="Módulos activos"
          value={String(byModule.length)}
          sub="fuentes de consumo"
          color="amber"
        />
      </div>

      {/* Quota Progress Bars */}
      {quotas.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-imperial-900">
            Cuota Mensual por Proveedor
          </h4>
          <div className="space-y-4">
            {quotas.map((q) => {
              const pct =
                q.cuota_mensual_tokens > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (q.tokens_consumidos / q.cuota_mensual_tokens) * 100
                      )
                    )
                  : 0;
              const isWarning = pct >= 80;
              return (
                <div key={q.provider_id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-imperial-900">
                      {q.provider_nombre}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        isWarning ? "text-amber-600" : "text-slate-600"
                      }`}
                    >
                      {isWarning && (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {pct}% ({q.tokens_consumidos.toLocaleString()} /{" "}
                      {q.cuota_mensual_tokens.toLocaleString()} tokens)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isWarning
                          ? "bg-gradient-to-r from-amber-400 to-red-500"
                          : "bg-gradient-to-r from-imperial-700 to-imperial-900"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isWarning && (
                    <p className="mt-1 text-xs text-amber-600">
                      ⚠️ Superó el 80% de la cuota mensual. Considera aumentar
                      el límite o reducir el consumo.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Area Chart */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="mb-5 text-sm font-semibold text-imperial-900">
          Consumo de Tokens — Últimos 30 días
        </h4>
        {chartData.length === 0 ? (
          <EmptyChart message="Sin datos de consumo en los últimos 30 días" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0b3061" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#0b3061" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 16px rgba(11,48,97,0.10)",
                  fontSize: 12,
                }}
                formatter={(value: unknown) => [
                  Number(value).toLocaleString() + " tokens",
                  "Consumo",
                ]}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#0b3061"
                strokeWidth={2}
                fill="url(#tokenGrad)"
                dot={{ fill: "#0b3061", r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Donut + Cost Cards Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donut Chart */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-imperial-900">
            Distribución por Módulo
          </h4>
          {donutData.length === 0 ? (
            <EmptyChart message="Sin datos de módulos" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PALETTE[i % PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-slate-600">{value}</span>
                  )}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => [
                    Number(value).toLocaleString() + " tokens",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Cost detail card */}
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-imperial-900">
            Estimación de Costo (USD)
          </h4>

          <div className="flex flex-1 flex-col justify-center gap-3">
            <CostRow
              label="Total tokens (30 días)"
              value={totalTokens.toLocaleString()}
              unit="tokens"
            />
            <CostRow
              label="Tarifa Gemini Flash Lite"
              value={`$${COST_PER_MILLION}`}
              unit="por 1M tokens"
            />
            <div className="my-2 border-t border-slate-100" />
            <CostRow
              label="Costo estimado total"
              value={`$${estimatedCost.toFixed(4)}`}
              unit="USD"
              highlight
            />
          </div>

          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
            💡 Tarifa de referencia para <strong>Gemini 2.5 Flash Lite</strong>.
            Consulta Google AI Studio para precios actualizados por modelo.
          </p>
        </section>
      </div>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "imperial" | "emerald" | "amber";
}) {
  const bg = {
    imperial: "bg-imperial-900/8",
    emerald: "bg-emerald-500/10",
    amber: "bg-amber-400/10",
  }[color];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold tracking-tight text-imperial-900">
          {value}
        </p>
        <p className="truncate text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function CostRow({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${
        highlight
          ? "bg-imperial-900 text-white"
          : "bg-slate-50 text-imperial-900"
      }`}
    >
      <span className={`text-sm ${highlight ? "font-semibold" : "font-medium"}`}>
        {label}
      </span>
      <div className="text-right">
        <span className={`text-sm font-bold ${highlight ? "text-white" : "text-imperial-900"}`}>
          {value}
        </span>
        <span
          className={`ml-1.5 text-xs ${
            highlight ? "text-white/70" : "text-slate-400"
          }`}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

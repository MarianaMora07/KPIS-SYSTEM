import type { DashboardKpiRow } from "../types";

const SERIES_COLORS = [
  "#d4af37",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#10b981",
  "#f59e0b",
];

export function getKpiOptions(rows: DashboardKpiRow[]) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!seen.has(row.kpi_id)) seen.set(row.kpi_id, row.kpi_nombre);
  }
  return Array.from(seen, ([id, nombre]) => ({ id, nombre }));
}

/** Agrupa histórico por fecha con una serie por hotel para el KPI seleccionado */
export function buildTrendSeries(
  history: DashboardKpiRow[],
  kpiId: string
): { data: Record<string, string | number>[]; series: { key: string; label: string; color: string }[] } {
  const filtered = history.filter((r) => r.kpi_id === kpiId);
  const hotels = [...new Set(filtered.map((r) => r.hotel_nombre ?? "General"))];
  const dates = [...new Set(filtered.map((r) => r.fecha))].sort();

  const data = dates.map((fecha) => {
    const point: Record<string, string | number> = { fecha: formatChartDate(fecha) };
    for (const hotel of hotels) {
      const row = filtered.find(
        (r) => r.fecha === fecha && (r.hotel_nombre ?? "General") === hotel
      );
      if (row) point[hotel] = Number(row.valor_real);
    }
    return point;
  });

  const series = hotels.map((hotel, i) => ({
    key: hotel,
    label: hotel,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
  }));

  return { data, series };
}

/** Último valor por hotel para comparar Real vs Meta */
export function buildVarianceData(
  history: DashboardKpiRow[],
  kpiId: string
): { hotel: string; real: number; meta: number | null }[] {
  const filtered = history.filter((r) => r.kpi_id === kpiId);
  const byHotel = new Map<string, DashboardKpiRow>();

  for (const row of filtered) {
    const key = row.hotel_nombre ?? "General";
    const existing = byHotel.get(key);
    if (!existing || row.fecha > existing.fecha) byHotel.set(key, row);
  }

  return Array.from(byHotel.values())
    .map((r) => ({
      hotel: r.hotel_nombre ?? "General",
      real: Number(r.valor_real),
      meta: r.valor_meta != null ? Number(r.valor_meta) : null,
    }))
    .sort((a, b) => a.hotel.localeCompare(b.hotel));
}

/** Top N combinaciones hotel/KPI con peor desempeño (riesgo o incumplimiento) */
export function getWorstPerformers(
  history: DashboardKpiRow[],
  limit = 3
): DashboardKpiRow[] {
  const latest = new Map<string, DashboardKpiRow>();
  for (const row of history) {
    const key = `${row.hotel_id ?? row.hotel_nombre}-${row.kpi_id}`;
    const existing = latest.get(key);
    if (!existing || row.fecha > existing.fecha) latest.set(key, row);
  }

  return Array.from(latest.values())
    .filter(
      (k) =>
        k.semaforo_calculado === "incumplimiento" ||
        k.semaforo_calculado === "riesgo"
    )
    .sort((a, b) => {
      const pctA = a.cumplimiento_pct ?? 0;
      const pctB = b.cumplimiento_pct ?? 0;
      return pctA - pctB;
    })
    .slice(0, limit);
}

function formatChartDate(iso: string): string {
  const [year, month] = iso.split("-");
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${months[Number(month) - 1]} ${year}`;
}

/** Comparativo mes actual vs anterior por KPI */
export function buildComparativeSeries(
  history: DashboardKpiRow[],
  kpiId: string,
  mode: "month" | "year" = "month"
): { label: string; actual: number; anterior: number }[] {
  const filtered = history
    .filter((r) => r.kpi_id === kpiId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const byPeriod = new Map<string, number>();
  for (const row of filtered) {
    const key =
      mode === "year"
        ? row.fecha.slice(0, 4)
        : row.fecha.slice(0, 7);
    byPeriod.set(key, Number(row.valor_real));
  }

  const periods = [...byPeriod.keys()].sort();
  const last = periods.slice(-2);

  if (last.length < 2) {
    return [{ label: "Comparativo", actual: byPeriod.get(last[0] ?? "") ?? 0, anterior: 0 }];
  }

  return [
    {
      label: mode === "year" ? "Año vs año" : "Mes vs mes",
      actual: byPeriod.get(last[1]) ?? 0,
      anterior: byPeriod.get(last[0]) ?? 0,
    },
  ];
}

/** Regresión lineal simple para proyección */
export function buildProjectionSeries(
  history: DashboardKpiRow[],
  kpiId: string,
  monthsAhead = 2
): { data: { fecha: string; real?: number; proyeccion?: number }[] } {
  const filtered = history
    .filter((r) => r.kpi_id === kpiId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const monthly = new Map<string, number>();
  for (const row of filtered) {
    const key = row.fecha.slice(0, 7);
    monthly.set(key, Number(row.valor_real));
  }

  const points = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (points.length < 2) {
    return {
      data: points.map(([fecha, val]) => ({
        fecha: formatChartDate(`${fecha}-01`),
        real: val,
      })),
    };
  }

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const [, y] = points[i];
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const data: { fecha: string; real?: number; proyeccion?: number }[] = points.map(([fecha, val], i) => ({
    fecha: formatChartDate(`${fecha}-01`),
    real: val,
    proyeccion: i === n - 1 ? val : undefined,
  }));

  const lastDate = points[n - 1][0];
  const [y, m] = lastDate.split("-").map(Number);
  for (let i = 1; i <= monthsAhead; i++) {
    const nextM = m + i;
    const nextY = y + Math.floor((nextM - 1) / 12);
    const month = ((nextM - 1) % 12) + 1;
    const fecha = `${nextY}-${String(month).padStart(2, "0")}`;
    data.push({
      fecha: formatChartDate(`${fecha}-01`),
      proyeccion: intercept + slope * (n - 1 + i),
    });
  }

  return { data };
}

import type { DashboardKpiRow } from "@/modules/dashboard/types";

const HOTELS = [
  { id: "h1", nombre: "Estelar Bogotá", region: "Región Andina", regionId: "r1" },
  { id: "h2", nombre: "Estelar Cartagena", region: "Región Caribe", regionId: "r2" },
  { id: "h3", nombre: "Estelar Cali", region: "Región Pacífico", regionId: "r3" },
] as const;

const MONTHS = [
  { fecha: "2026-03-01", label: "Mar" },
  { fecha: "2026-04-01", label: "Abr" },
  { fecha: "2026-05-01", label: "May" },
  { fecha: "2026-06-01", label: "Jun" },
];

type KpiDef = {
  kpi_id: string;
  kpi_nombre: string;
  kpi_codigo: string;
  unidad_medida: string;
  /** valores por mes para cada hotel [bogota, cartagena, cali] */
  values: { real: number[]; meta: number }[];
  semaforos: ("cumplimiento" | "riesgo" | "incumplimiento")[][];
};

const KPI_DEFS: KpiDef[] = [
  {
    kpi_id: "d1",
    kpi_nombre: "Ocupación",
    kpi_codigo: "OCP-001",
    unidad_medida: "%",
    values: [
      { real: [76.2, 68.5, 71.0], meta: 82 },
      { real: [79.1, 70.2, 73.5], meta: 82 },
      { real: [81.2, 72.8, 75.0], meta: 82 },
      { real: [78.4, 74.1, 77.2], meta: 82 },
    ],
    semaforos: [
      ["riesgo", "incumplimiento", "incumplimiento"],
      ["riesgo", "incumplimiento", "incumplimiento"],
      ["riesgo", "riesgo", "riesgo"],
      ["riesgo", "riesgo", "riesgo"],
    ],
  },
  {
    kpi_id: "d2",
    kpi_nombre: "RevPAR",
    kpi_codigo: "RVP-001",
    unidad_medida: "COP",
    values: [
      { real: [128000, 195000, 112000], meta: 138000 },
      { real: [135000, 202000, 118000], meta: 138000 },
      { real: [140000, 210000, 125000], meta: 138000 },
      { real: [142500, 215000, 130000], meta: 138000 },
    ],
    semaforos: [
      ["riesgo", "cumplimiento", "incumplimiento"],
      ["riesgo", "cumplimiento", "incumplimiento"],
      ["cumplimiento", "cumplimiento", "riesgo"],
      ["cumplimiento", "cumplimiento", "riesgo"],
    ],
  },
  {
    kpi_id: "d3",
    kpi_nombre: "Conversión web",
    kpi_codigo: "CNV-001",
    unidad_medida: "%",
    values: [
      { real: [1.8, 2.4, 1.5], meta: 2.5 },
      { real: [1.9, 2.3, 1.7], meta: 2.5 },
      { real: [2.0, 2.2, 1.9], meta: 2.5 },
      { real: [2.1, 2.0, 2.2], meta: 2.5 },
    ],
    semaforos: [
      ["incumplimiento", "riesgo", "incumplimiento"],
      ["incumplimiento", "riesgo", "incumplimiento"],
      ["incumplimiento", "incumplimiento", "riesgo"],
      ["incumplimiento", "incumplimiento", "riesgo"],
    ],
  },
  {
    kpi_id: "d4",
    kpi_nombre: "NPS",
    kpi_codigo: "NPS-001",
    unidad_medida: "pts",
    values: [
      { real: [68, 74, 65], meta: 70 },
      { real: [70, 75, 68], meta: 70 },
      { real: [71, 76, 70], meta: 70 },
      { real: [72, 78, 71], meta: 70 },
    ],
    semaforos: [
      ["riesgo", "cumplimiento", "riesgo"],
      ["cumplimiento", "cumplimiento", "riesgo"],
      ["cumplimiento", "cumplimiento", "cumplimiento"],
      ["cumplimiento", "cumplimiento", "cumplimiento"],
    ],
  },
];

function buildDemoRows(): DashboardKpiRow[] {
  const rows: DashboardKpiRow[] = [];
  let id = 1;

  for (const kpi of KPI_DEFS) {
    for (let m = 0; m < MONTHS.length; m++) {
      const month = MONTHS[m];
      const entry = kpi.values[m];
      for (let h = 0; h < HOTELS.length; h++) {
        const hotel = HOTELS[h];
        const real = entry.real[h];
        const meta = entry.meta;
        const cumplimiento = meta > 0 ? Number(((real / meta) * 100).toFixed(2)) : null;
        rows.push({
          id: `demo-${id++}`,
          kpi_id: kpi.kpi_id,
          kpi_nombre: kpi.kpi_nombre,
          kpi_codigo: kpi.kpi_codigo,
          unidad_medida: kpi.unidad_medida,
          hotel_id: hotel.id,
          hotel_nombre: hotel.nombre,
          region_id: hotel.regionId,
          region_nombre: hotel.region,
          fecha: month.fecha,
          valor_real: real,
          valor_meta: meta,
          cumplimiento_pct: cumplimiento,
          semaforo_calculado: kpi.semaforos[m][h],
          fuente: "manual",
        });
      }
    }
  }

  return rows;
}

export const DEMO_DASHBOARD_DATA: DashboardKpiRow[] = buildDemoRows();

export const DEMO_REGIONS = [
  { id: "r1", nombre: "Región Andina" },
  { id: "r2", nombre: "Región Caribe" },
  { id: "r3", nombre: "Región Pacífico" },
];

export const DEMO_HOTELS = HOTELS.map((h) => ({ id: h.id, nombre: h.nombre, region_id: h.regionId }));

/** Filtra datos demo según los mismos criterios del dashboard */
export function filterDemoData(
  data: DashboardKpiRow[],
  filters: {
    regionId?: string;
    hotelId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }
): DashboardKpiRow[] {
  return data.filter((row) => {
    if (filters.regionId && row.region_id !== filters.regionId) return false;
    if (filters.hotelId && row.hotel_id !== filters.hotelId) return false;
    if (filters.fechaDesde && row.fecha < filters.fechaDesde) return false;
    if (filters.fechaHasta && row.fecha > filters.fechaHasta) return false;
    return true;
  });
}

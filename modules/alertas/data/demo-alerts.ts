import type { AlertRow } from "../types";

export const DEMO_ALERTS: AlertRow[] = [
  {
    id: "alert-demo-1",
    kpi_id: "d3",
    kpi_value_id: null,
    hotel_id: "h2",
    region_id: "r2",
    severidad: "critico",
    estado: "activa",
    mensaje:
      'KPI "Conversión web" en estado incumplimiento — Estelar Cartagena. Valor: 2.1, Meta: 2.5, Cumplimiento: 84%',
    escalada: false,
    escalada_at: null,
    resuelta_at: null,
    created_at: "2026-06-01T10:00:00Z",
    kpi_nombre: "Conversión web",
    hotel_nombre: "Estelar Cartagena",
    region_nombre: "Región Caribe",
  },
  {
    id: "alert-demo-2",
    kpi_id: "d1",
    kpi_value_id: null,
    hotel_id: "h1",
    region_id: "r1",
    severidad: "riesgo",
    estado: "activa",
    mensaje:
      'KPI "Ocupación" en estado riesgo — Estelar Bogotá. Valor: 78.4, Meta: 82, Cumplimiento: 95.61%',
    escalada: false,
    escalada_at: null,
    resuelta_at: null,
    created_at: "2026-06-01T09:30:00Z",
    kpi_nombre: "Ocupación",
    hotel_nombre: "Estelar Bogotá",
    region_nombre: "Región Andina",
  },
];

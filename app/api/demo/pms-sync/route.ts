import { NextResponse } from "next/server";

/**
 * Endpoint de prueba para integraciones (PMS / CRM / ERP / API).
 * URL en la app: http://localhost:3000/api/demo/pms-sync
 */
export async function GET() {
  const fecha = new Date().toISOString().slice(0, 10);

  return NextResponse.json([
    {
      kpi_codigo: "OCP-001",
      valor: 81.2,
      fecha,
    },
    {
      kpi_codigo: "RVP-001",
      valor: 141500,
      fecha,
    },
    {
      kpi_codigo: "CNV-001",
      fecha,
      variables: {
        visitas_mes: 1200,
        reservas_web: 30,
      },
    },
  ]);
}

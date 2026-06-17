import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { EXPECTED_COLUMNS } from "@/modules/import/constants";

export async function GET() {
  const headers = [
    ...EXPECTED_COLUMNS,
    "var_visitas_mes",
    "var_reservas_web",
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ["OCP-001", "2026-06-01", 85.5, "BOG", 90, "", ""],
    ["RVP-001", "2026-06-01", 125000, "CTG", 130000, "", ""],
    ["CNV-001", "2026-06-01", "", "CTG", 2.5, 1000, 25],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "KPIs");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-kpis.xlsx"',
    },
  });
}

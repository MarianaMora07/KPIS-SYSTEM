import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { EXPECTED_COLUMNS } from "@/modules/import/constants";

export async function GET() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...EXPECTED_COLUMNS],
    ["OCP-001", "2026-06-01", 85.5, "HTL-BOG", 90],
    ["REV-001", "2026-06-01", 1250000, "HTL-MED", 1300000],
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

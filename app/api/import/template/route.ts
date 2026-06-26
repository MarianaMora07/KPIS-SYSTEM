import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { EXPECTED_COLUMNS } from "@/modules/import/constants";

export async function GET() {
  const variableColumns = ["var_visitas_mes", "var_reservas_web"];
  const headers = [...EXPECTED_COLUMNS, "valor_meta", ...variableColumns];

  const guideRows = [
    ["Guía de importación — Valores KPI"],
    [""],
    ["¿Qué importa este archivo?"],
    ["Registros de valores (kpi_values) para indicadores que ya existen en el sistema."],
    [""],
    ["Columnas obligatorias"],
    ["kpi_codigo", "Código del KPI tal como está en el catálogo (ej. OCP-001, CNV-001)."],
    ["fecha", "Fecha del valor en formato AAAA-MM-DD (ej. 2026-06-01)."],
    ["valor_real O variables", "Use valor_real si el KPI no tiene fórmula. Si tiene fórmula, use columnas var_{codigo}."],
    [""],
    ["Columnas opcionales"],
    ["hotel_codigo", "Código del hotel cuando el valor aplica a un hotel específico."],
    ["valor_meta", "Meta del periodo, si desea cargarla junto con el valor."],
    ["var_{codigo}", "Una columna por variable de la fórmula (ej. var_visitas_mes, var_reservas_web)."],
    [""],
    ["Ejemplos de uso"],
    ["KPI sin fórmula", "Complete kpi_codigo, fecha, valor_real y opcionalmente hotel_codigo."],
    ["KPI con fórmula", "Complete kpi_codigo, fecha, las columnas var_* y deje valor_real vacío."],
    [""],
    ["Notas"],
    ["• Las variables y fórmulas se configuran en el detalle de cada KPI (administrador)."],
    ["• En la hoja «Datos» solo la primera fila son encabezados; no modifique los nombres técnicos."],
    ["• Puede agregar más columnas var_* según las variables de su indicador."],
  ];

  const dataRows = [
    headers,
    ["OCP-001", "2026-06-01", 85.5, "BOG", 90, "", ""],
    ["RVP-001", "2026-06-01", 125000, "CTG", 130000, "", ""],
    ["CNV-001", "2026-06-01", "", "CTG", 2.5, 1000, 25],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guideRows), "Guía");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows), "Datos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-kpis.xlsx"',
    },
  });
}

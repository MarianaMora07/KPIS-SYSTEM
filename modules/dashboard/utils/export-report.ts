import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  formatKpiValue,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";

const SEMAFORO_LABELS: Record<string, string> = {
  cumplimiento: "Cumplimiento",
  riesgo: "Riesgo",
  incumplimiento: "Incumplimiento",
};

export function exportToExcel(rows: DashboardKpiRow[], filename = "reporte-kpis") {
  const data = rows.map((r) => ({
    KPI: r.kpi_nombre,
    Código: r.kpi_codigo,
    Hotel: r.hotel_nombre ?? "—",
    Región: r.region_nombre ?? "—",
    Fecha: r.fecha,
    "Valor real": r.valor_real,
    Meta: r.valor_meta ?? "",
    "Cumplimiento %": r.cumplimiento_pct ?? "",
    Estado: SEMAFORO_LABELS[r.semaforo_calculado ?? ""] ?? "—",
    Fuente: r.fuente,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "KPIs");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPdf(
  rows: DashboardKpiRow[],
  filters: { region?: string; hotel?: string; periodo?: string },
  filename = "reporte-ejecutivo-kpis",
  executiveSummary?: string | null
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const now = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setFontSize(18);
  doc.setTextColor(10, 25, 47);
  doc.text("Reporte Ejecutivo de KPIs", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const filterParts = [
    filters.periodo ? `Período: ${filters.periodo}` : null,
    filters.region ? `Región: ${filters.region}` : "Región: Todas",
    filters.hotel ? `Hotel: ${filters.hotel}` : "Hotel: Todos",
    `Generado: ${now}`,
  ].filter(Boolean);
  doc.text(filterParts.join("  ·  "), 14, 26);

  let tableStartY = 32;

  if (executiveSummary) {
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.text("Resumen ejecutivo (IA)", 14, 34);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(executiveSummary, 260);
    doc.text(lines, 14, 40);
    tableStartY = 40 + lines.length * 5 + 4;
  }

  const tableData = rows.map((r) => [
    r.kpi_nombre,
    r.hotel_nombre ?? "—",
    r.fecha,
    formatKpiValue(Number(r.valor_real), r.unidad_medida),
    r.valor_meta != null
      ? formatKpiValue(Number(r.valor_meta), r.unidad_medida)
      : "—",
    r.cumplimiento_pct != null ? `${r.cumplimiento_pct}%` : "—",
    SEMAFORO_LABELS[r.semaforo_calculado ?? ""] ?? "—",
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [["KPI", "Hotel", "Fecha", "Real", "Meta", "Cumplimiento", "Estado"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [10, 25, 47], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportToPptx(
  rows: DashboardKpiRow[],
  filters: { region?: string; hotel?: string; periodo?: string },
  filename = "reporte-ejecutivo-kpis"
) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();

  const titleSlide = pptx.addSlide();
  titleSlide.addText("Reporte Ejecutivo de KPIs", {
    x: 0.5,
    y: 1,
    w: 9,
    fontSize: 28,
    bold: true,
    color: "0A192F",
  });
  titleSlide.addText(
    [
      filters.periodo ? `Período: ${filters.periodo}` : null,
      filters.region ? `Región: ${filters.region}` : "Región: Todas",
      filters.hotel ? `Hotel: ${filters.hotel}` : "Hotel: Todos",
    ]
      .filter(Boolean)
      .join(" · "),
    { x: 0.5, y: 2.2, w: 9, fontSize: 14, color: "64748B" }
  );

  const kpiSlide = pptx.addSlide();
  kpiSlide.addText("Indicadores clave", {
    x: 0.5,
    y: 0.3,
    w: 9,
    fontSize: 20,
    bold: true,
  });

  const tableRows: { text: string }[][] = [
    [
      { text: "KPI" },
      { text: "Hotel" },
      { text: "Real" },
      { text: "Meta" },
      { text: "Estado" },
    ],
    ...rows.slice(0, 12).map((r) => [
      { text: r.kpi_nombre },
      { text: r.hotel_nombre ?? "—" },
      { text: formatKpiValue(Number(r.valor_real), r.unidad_medida) },
      {
        text:
          r.valor_meta != null
            ? formatKpiValue(Number(r.valor_meta), r.unidad_medida)
            : "—",
      },
      { text: SEMAFORO_LABELS[r.semaforo_calculado ?? ""] ?? "—" },
    ]),
  ];

  kpiSlide.addTable(tableRows, {
    x: 0.3,
    y: 0.9,
    w: 9.4,
    fontSize: 10,
    border: { type: "solid", color: "E2E8F0" },
    fill: { color: "F8FAFC" },
  });

  await pptx.writeFile({ fileName: `${filename}.pptx` });
}

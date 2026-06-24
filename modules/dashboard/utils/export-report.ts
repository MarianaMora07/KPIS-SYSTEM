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

/** Paleta blanco y negro para PDF */
const PDF = {
  black: [0, 0, 0] as [number, number, number],
  dark: [40, 40, 40] as [number, number, number],
  mid: [100, 100, 100] as [number, number, number],
  light: [245, 245, 245] as [number, number, number],
  border: [190, 190, 190] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

/** Colores semáforo para PowerPoint */
const PPT_STATUS_COLORS = {
  cumplimiento: "22C55E",
  riesgo: "F59E0B",
  incumplimiento: "EF4444",
  default: "94A3B8",
};

interface ReportStats {
  cumplimiento: number;
  riesgo: number;
  incumplimiento: number;
  total: number;
  avgCumplimiento: number;
  avgDesviacion: number;
}

function computeReportStats(rows: DashboardKpiRow[]): ReportStats {
  const cumplimiento = rows.filter(
    (r) => r.semaforo_calculado === "cumplimiento"
  ).length;
  const riesgo = rows.filter((r) => r.semaforo_calculado === "riesgo").length;
  const incumplimiento = rows.filter(
    (r) => r.semaforo_calculado === "incumplimiento"
  ).length;
  const withPct = rows.filter((r) => r.cumplimiento_pct != null);
  const avgCumplimiento =
    withPct.length > 0
      ? withPct.reduce((s, r) => s + (r.cumplimiento_pct ?? 0), 0) /
        withPct.length
      : 0;
  const avgDesviacion = avgCumplimiento - 100;

  return {
    cumplimiento,
    riesgo,
    incumplimiento,
    total: rows.length,
    avgCumplimiento,
    avgDesviacion,
  };
}

function desviacionVsMeta(row: DashboardKpiRow): string {
  if (row.cumplimiento_pct == null) return "—";
  const diff = row.cumplimiento_pct - 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`;
}

function buildRecommendations(rows: DashboardKpiRow[]): string[] {
  const bullets: string[] = [];
  const critical = rows.filter(
    (r) =>
      r.semaforo_calculado === "incumplimiento" ||
      r.semaforo_calculado === "riesgo"
  );

  for (const r of critical.slice(0, 3)) {
    const hotel = r.hotel_nombre ?? "la cadena";
    if (r.semaforo_calculado === "incumplimiento") {
      bullets.push(
        `Validar y analizar ${r.kpi_nombre} en ${hotel} por incumplimiento de meta.`
      );
    } else {
      bullets.push(
        `Priorizar acciones para mejorar ${r.kpi_nombre} en ${hotel}.`
      );
    }
  }

  const good = rows.filter((r) => r.semaforo_calculado === "cumplimiento");
  if (good.length > 0) {
    bullets.push(
      `Replicar las prácticas exitosas asociadas al desempeño de ${good[0].kpi_nombre} (${good[0].hotel_nombre ?? "cadena"}).`
    );
  }

  if (bullets.length === 0) {
    bullets.push("Mantener el seguimiento periódico de los indicadores clave.");
  }

  return bullets.slice(0, 4);
}

function formatFilterLine(
  filters: { region?: string; hotel?: string; periodo?: string },
  now: string
): string {
  return [
    `Período: ${filters.periodo ?? "Sin período"}`,
    `Región: ${filters.region ?? "Todas"}`,
    `Hotel: ${filters.hotel ?? "Todos"}`,
    `Generado: ${now}`,
  ].join("  ·  ");
}

/** Quita marcadores markdown del resumen IA para PDF/PPTX */
function plainSummaryText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "").trim();
}

/** Constantes de layout PowerPoint (slide 10" × 5.625") */
const PPT = {
  margin: 0.5,
  width: 9.0,
  pad: 0.15,
  textW: 8.7,
  tableFontSize: 9,
  bodyFontSize: 9,
  summaryFontSize: 8.5,
};

const PDF_MARGIN = 14;
const PDF_FOOTER_RESERVE = 12;
const PPT_ROWS_PER_TABLE_SLIDE = 11;
const PDF_TABLE_FONT_SIZE = 10;
const PDF_TABLE_HEAD_FONT_SIZE = 10;
const PDF_TABLE_CELL_PADDING = 3.5;
const PDF_BODY_FONT_SIZE = 10;
const PDF_SECTION_TITLE_SIZE = 11;
const PDF_FILTER_LINE_SIZE = 10;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function pdfBottomLimit(pageH: number): number {
  return pageH - PDF_MARGIN - PDF_FOOTER_RESERVE;
}

function ensurePdfSpace(doc: jsPDF, y: number, needed: number, pageH: number): number {
  if (y + needed > pdfBottomLimit(pageH)) {
    doc.addPage();
    return PDF_MARGIN + 8;
  }
  return y;
}

function drawPdfFooters(
  doc: jsPDF,
  margin: number,
  pageW: number,
  pageH: number
) {
  const footerY = pageH - 8;
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF.mid);
    doc.text(
      "Los datos corresponden al período seleccionado y pueden estar sujetos a actualizaciones.",
      margin,
      footerY
    );
    doc.text(`Página ${page} de ${pageCount}`, pageW - margin, footerY, {
      align: "right",
    });
  }
}

function drawPdfWrappedSection(
  doc: jsPDF,
  title: string,
  text: string,
  y: number,
  margin: number,
  contentW: number,
  pageH: number
): number {
  const innerW = contentW - 10;
  const lineH = 4.8;
  const lines = doc.splitTextToSize(text, innerW);
  let currentY = ensurePdfSpace(doc, y, 14 + lines.length * lineH, pageH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_SECTION_TITLE_SIZE);
  doc.setTextColor(...PDF.black);
  doc.text(title, margin, currentY);
  currentY += 5;

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const available = Math.floor((pdfBottomLimit(pageH) - currentY - 8) / lineH);
    if (available <= 0) {
      doc.addPage();
      currentY = PDF_MARGIN + 8;
      continue;
    }
    const slice = lines.slice(lineIndex, lineIndex + available);
    const boxH = slice.length * lineH + 8;
    doc.setDrawColor(...PDF.border);
    doc.setFillColor(...PDF.light);
    doc.roundedRect(margin, currentY, contentW, boxH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_BODY_FONT_SIZE);
    doc.setTextColor(...PDF.dark);
    doc.text(slice, margin + 5, currentY + 6);
    lineIndex += slice.length;
    currentY += boxH + 7;
    if (lineIndex < lines.length) {
      doc.addPage();
      currentY = PDF_MARGIN + 8;
    }
  }
  return currentY;
}

function buildDetailTableBody(rows: DashboardKpiRow[]) {
  return rows.map((r) => [
    r.kpi_nombre,
    r.hotel_nombre ?? "—",
    r.fecha,
    formatKpiValue(Number(r.valor_real), r.unidad_medida),
    r.valor_meta != null
      ? formatKpiValue(Number(r.valor_meta), r.unidad_medida)
      : "—",
    r.cumplimiento_pct != null ? `${r.cumplimiento_pct}%` : "—",
    SEMAFORO_LABELS[r.semaforo_calculado ?? ""] ?? "—",
    desviacionVsMeta(r),
  ]);
}

function detailTableColumnStyles(contentW: number) {
  return {
    0: { cellWidth: contentW * 0.2 },
    1: { cellWidth: contentW * 0.16 },
    2: { cellWidth: contentW * 0.1 },
    3: { cellWidth: contentW * 0.12 },
    4: { cellWidth: contentW * 0.12 },
    5: { cellWidth: contentW * 0.12 },
    6: { cellWidth: contentW * 0.1 },
    7: { cellWidth: contentW * 0.08, halign: "right" as const },
  };
}

function statusColor(status: string | null | undefined): string {
  if (status && status in PPT_STATUS_COLORS) {
    return PPT_STATUS_COLORS[status as keyof typeof PPT_STATUS_COLORS];
  }
  return PPT_STATUS_COLORS.default;
}

function buildPptDetailRows(rows: DashboardKpiRow[]) {
  return rows.map((r) => [
    { text: r.kpi_nombre },
    { text: r.hotel_nombre ?? "—" },
    { text: formatKpiValue(Number(r.valor_real), r.unidad_medida) },
    {
      text:
        r.valor_meta != null
          ? formatKpiValue(Number(r.valor_meta), r.unidad_medida)
          : "—",
    },
    {
      text: r.cumplimiento_pct != null ? `${r.cumplimiento_pct}%` : "—",
      options: { color: statusColor(r.semaforo_calculado) },
    },
    {
      text: SEMAFORO_LABELS[r.semaforo_calculado ?? ""] ?? "—",
      options: { color: statusColor(r.semaforo_calculado) },
    },
  ]);
}

const PPT_DETAIL_HEADER = [
  { text: "KPI", options: { bold: true, fill: { color: "0B3061" }, color: "FFFFFF" } },
  { text: "Hotel", options: { bold: true, fill: { color: "0B3061" }, color: "FFFFFF" } },
  { text: "Real", options: { bold: true, fill: { color: "0B3061" }, color: "FFFFFF" } },
  { text: "Meta", options: { bold: true, fill: { color: "0B3061" }, color: "FFFFFF" } },
  { text: "Cumpl.", options: { bold: true, fill: { color: "0B3061" }, color: "FFFFFF" } },
  { text: "Estado", options: { bold: true, fill: { color: "0B3061" }, color: "FFFFFF" } },
];

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
  const doc = new jsPDF({ orientation: "landscape", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PDF_MARGIN;
  const contentW = pageW - margin * 2;
  const tableMargin = {
    left: margin,
    right: margin,
    top: margin,
    bottom: margin + PDF_FOOTER_RESERVE,
  };
  const now = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...PDF.black);
  doc.text("Reporte Ejecutivo de KPIs", margin, y);
  doc.setFontSize(9);
  doc.setTextColor(...PDF.mid);
  doc.text("ESTELAR HOTELES", pageW - margin, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FILTER_LINE_SIZE);
  doc.text(formatFilterLine(filters, now), margin, y);

  y += 8;
  const stats = computeReportStats(rows);
  const recommendations = buildRecommendations(rows);
  const summaryRaw =
    executiveSummary ??
    `Durante el período analizado se registraron ${stats.total} indicadores. ` +
      `${stats.cumplimiento} en cumplimiento, ${stats.riesgo} en riesgo y ${stats.incumplimiento} en incumplimiento.`;
  const summaryText = plainSummaryText(summaryRaw);

  y = drawPdfWrappedSection(
    doc,
    "Resumen Ejecutivo",
    summaryText,
    y,
    margin,
    contentW,
    pageH
  );

  y = ensurePdfSpace(doc, y, 40, pageH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_SECTION_TITLE_SIZE);
  doc.setTextColor(...PDF.black);
  doc.text("Indicadores clave", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    head: [["Indicador", "Valor"]],
    body: [
      ["KPIs en cumplimiento", String(stats.cumplimiento)],
      ["KPIs en riesgo", String(stats.riesgo)],
      ["KPIs en incumplimiento", String(stats.incumplimiento)],
      [
        "Cumplimiento promedio",
        stats.total > 0 ? `${stats.avgCumplimiento.toFixed(2)}%` : "—",
      ],
      [
        "Desviación promedio vs. meta",
        stats.total > 0
          ? `${stats.avgDesviacion >= 0 ? "+" : ""}${stats.avgDesviacion.toFixed(2)}%`
          : "—",
      ],
    ],
    tableWidth: Math.min(120, contentW * 0.45),
    styles: {
      fontSize: PDF_TABLE_FONT_SIZE,
      cellPadding: PDF_TABLE_CELL_PADDING,
      textColor: PDF.dark,
      lineColor: PDF.border,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PDF.black,
      textColor: PDF.white,
      fontStyle: "bold",
      fontSize: PDF_TABLE_HEAD_FONT_SIZE,
    },
    alternateRowStyles: { fillColor: PDF.light },
    showHead: "everyPage",
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
    7;

  y = ensurePdfSpace(doc, y, 16, pageH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_SECTION_TITLE_SIZE);
  doc.text("Detalle de KPIs", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "KPI",
        "Hotel",
        "Fecha",
        "Real",
        "Meta",
        "Cumplimiento",
        "Estado",
        "Desv. vs meta",
      ],
    ],
    body: buildDetailTableBody(rows),
    margin: tableMargin,
    tableWidth: contentW,
    styles: {
      fontSize: PDF_TABLE_FONT_SIZE,
      cellPadding: PDF_TABLE_CELL_PADDING,
      textColor: PDF.dark,
      lineColor: PDF.border,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PDF.black,
      textColor: PDF.white,
      fontStyle: "bold",
      fontSize: PDF_TABLE_HEAD_FONT_SIZE,
    },
    alternateRowStyles: { fillColor: PDF.light },
    columnStyles: detailTableColumnStyles(contentW),
    showHead: "everyPage",
    rowPageBreak: "auto",
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
    7;

  y = drawPdfWrappedSection(
    doc,
    "Recomendaciones",
    recommendations.map((item) => `• ${item}`).join("\n"),
    ensurePdfSpace(doc, y, 20, pageH),
    margin,
    contentW,
    pageH
  );

  drawPdfFooters(doc, margin, pageW, pageH);
  doc.save(`${filename}.pdf`);
}

export async function exportToPptx(
  rows: DashboardKpiRow[],
  filters: { region?: string; hotel?: string; periodo?: string },
  filename = "reporte-ejecutivo-kpis",
  executiveSummary?: string | null
) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const now = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const stats = computeReportStats(rows);
  const recommendations = buildRecommendations(rows);
  const summaryText = plainSummaryText(
    executiveSummary ??
      `Durante el período analizado se registraron ${stats.total} indicadores con desempeño mixto.`
  );

  const { margin: px, width: pw, pad, textW, tableFontSize, bodyFontSize, summaryFontSize } =
    PPT;
  const textX = px + pad;

  // —— Diapositiva 1: resumen + tabla ——
  const slide1 = pptx.addSlide();
  slide1.background = { color: "FFFFFF" };

  slide1.addText("Reporte Ejecutivo de KPIs", {
    x: px,
    y: 0.25,
    w: 6.5,
    fontSize: 22,
    bold: true,
    color: "0B3061",
  });

  slide1.addText("ESTELAR HOTELES", {
    x: px + pw - 2.5,
    y: 0.3,
    w: 2.5,
    fontSize: 11,
    bold: true,
    color: "0B3061",
    align: "right",
  });

  slide1.addText(formatFilterLine(filters, now), {
    x: px,
    y: 0.72,
    w: pw,
    fontSize: 9,
    color: "64748B",
  });

  const summaryBoxY = 1.0;
  const summaryBoxH = 1.45;

  slide1.addShape(pptx.ShapeType.roundRect, {
    x: px,
    y: summaryBoxY,
    w: pw,
    h: summaryBoxH,
    fill: { color: "E8F0F8" },
    line: { color: "CBD5E1", width: 0.5 },
    rectRadius: 0.05,
  });
  slide1.addText("Resumen ejecutivo (IA)", {
    x: textX,
    y: summaryBoxY + 0.08,
    w: 4,
    fontSize: 9,
    bold: true,
    color: "0B3061",
  });
  slide1.addText(summaryText, {
    x: textX,
    y: summaryBoxY + 0.32,
    w: textW,
    h: summaryBoxH - 0.38,
    fontSize: summaryFontSize,
    color: "334155",
    valign: "top",
    breakLine: true,
    fit: "shrink",
  });

  const cardsY = summaryBoxY + summaryBoxH + 0.2;
  const cardW = (pw - 0.16) / 5;

  const cards = [
    {
      label: "KPIs en cumplimiento",
      value: String(stats.cumplimiento),
      sub: stats.total
        ? `${Math.round((stats.cumplimiento / stats.total) * 100)}% del total`
        : "",
      color: "DCFCE7",
      accent: "16A34A",
    },
    {
      label: "KPIs en riesgo",
      value: String(stats.riesgo),
      sub: stats.total
        ? `${Math.round((stats.riesgo / stats.total) * 100)}% del total`
        : "",
      color: "FEF3C7",
      accent: "D97706",
    },
    {
      label: "KPIs en incumplimiento",
      value: String(stats.incumplimiento),
      sub: stats.total
        ? `${Math.round((stats.incumplimiento / stats.total) * 100)}% del total`
        : "",
      color: "FEE2E2",
      accent: "DC2626",
    },
    {
      label: "Cumplimiento promedio",
      value: stats.total > 0 ? `${stats.avgCumplimiento.toFixed(2)}%` : "—",
      sub: "vs. 100% meta",
      color: "DBEAFE",
      accent: "2563EB",
    },
    {
      label: "Desviación promedio",
      value:
        stats.total > 0
          ? `${stats.avgDesviacion >= 0 ? "+" : ""}${stats.avgDesviacion.toFixed(2)}%`
          : "—",
      sub: "vs. meta",
      color: "E8F0F8",
      accent: "0B3061",
    },
  ];

  cards.forEach((card, i) => {
    const x = px + i * (cardW + 0.04);
    slide1.addShape(pptx.ShapeType.roundRect, {
      x,
      y: cardsY,
      w: cardW,
      h: 0.95,
      fill: { color: card.color },
      line: { color: "E2E8F0", width: 0.5 },
      rectRadius: 0.04,
    });
    slide1.addText(card.label, {
      x: x + 0.06,
      y: cardsY + 0.05,
      w: cardW - 0.1,
      fontSize: 7.5,
      color: "475569",
    });
    slide1.addText(card.value, {
      x: x + 0.06,
      y: cardsY + 0.28,
      w: cardW - 0.1,
      fontSize: 16,
      bold: true,
      color: card.accent,
    });
    slide1.addText(card.sub, {
      x: x + 0.06,
      y: cardsY + 0.62,
      w: cardW - 0.1,
      fontSize: 7,
      color: "64748B",
    });
  });

  const tableChunks = chunkArray(rows, PPT_ROWS_PER_TABLE_SLIDE);
  tableChunks.forEach((chunk, index) => {
    const tableSlide = pptx.addSlide();
    tableSlide.background = { color: "FFFFFF" };
    tableSlide.addText(
      index === 0 ? "Detalle de KPIs" : `Detalle de KPIs (continuación ${index + 1})`,
      {
        x: px,
        y: 0.35,
        w: pw,
        fontSize: 18,
        bold: true,
        color: "0B3061",
      }
    );
    tableSlide.addTable([PPT_DETAIL_HEADER, ...buildPptDetailRows(chunk)], {
      x: px,
      y: 0.85,
      w: pw,
      h: 4.55,
      fontSize: tableFontSize,
      border: { type: "solid", color: "E2E8F0", pt: 0.5 },
      fill: { color: "F8FAFC" },
      colW: [2.0, 1.6, 1.3, 1.3, 1.1, 1.3],
      autoPage: false,
      valign: "middle",
    });
  });

  // —— Gráficos ——
  const slide2 = pptx.addSlide();
  slide2.background = { color: "FFFFFF" };

  slide2.addText("Análisis visual y recomendaciones", {
    x: px,
    y: 0.3,
    w: pw,
    fontSize: 18,
    bold: true,
    color: "0B3061",
  });

  if (stats.total > 0) {
    slide2.addText("Cumplimiento por estado", {
      x: px,
      y: 0.85,
      w: 3.5,
      fontSize: 10,
      bold: true,
      color: "0B3061",
    });

    slide2.addChart(
      pptx.ChartType.doughnut,
      [
        {
          name: "Estado",
          labels: ["Cumplimiento", "Riesgo", "Incumplimiento"],
          values: [stats.cumplimiento, stats.riesgo, stats.incumplimiento],
        },
      ],
      {
        x: px,
        y: 1.1,
        w: 3.2,
        h: 2.8,
        showLegend: true,
        legendPos: "b",
        chartColors: ["22C55E", "F59E0B", "EF4444"],
        showPercent: true,
      }
    );

    slide2.addText("Cumplimiento vs. Meta", {
      x: px + 3.5,
      y: 0.85,
      w: 5.5,
      fontSize: 10,
      bold: true,
      color: "0B3061",
    });

    const chartRows = rows.slice(0, 12);
    slide2.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Cumplimiento %",
          labels: chartRows.map(
            (r) =>
              `${r.kpi_nombre}`.slice(0, 14) +
              (r.hotel_nombre ? ` ${r.hotel_nombre.split(" ").pop()}` : "")
          ),
          values: chartRows.map((r) => r.cumplimiento_pct ?? 0),
        },
      ],
      {
        x: px + 3.45,
        y: 1.1,
        w: 5.55,
        h: 2.8,
        barDir: "bar",
        chartColors: chartRows.map((r) => statusColor(r.semaforo_calculado)),
        valAxisMaxVal: 120,
        showValue: true,
        dataLabelPosition: "outEnd",
        fontSize: 8,
      }
    );
  }

  const recommendationChunks = chunkArray(recommendations, 3);
  recommendationChunks.forEach((chunk, index) => {
    const recSlide = pptx.addSlide();
    recSlide.background = { color: "FFFFFF" };
    recSlide.addText(
      index === 0
        ? "Recomendaciones"
        : `Recomendaciones (continuación ${index + 1})`,
      {
        x: px,
        y: 0.35,
        w: pw,
        fontSize: 18,
        bold: true,
        color: "0B3061",
      }
    );

    const recBoxY = 0.9;
    const recBoxH = 4.4;
    recSlide.addShape(pptx.ShapeType.roundRect, {
      x: px,
      y: recBoxY,
      w: pw,
      h: recBoxH,
      fill: { color: "E8F0F8" },
      line: { color: "CBD5E1", width: 0.5 },
      rectRadius: 0.04,
    });
    recSlide.addText(chunk.map((item) => `• ${item}`).join("\n\n"), {
      x: textX,
      y: recBoxY + 0.2,
      w: textW,
      h: recBoxH - 0.35,
      fontSize: bodyFontSize,
      color: "334155",
      valign: "top",
      breakLine: true,
      fit: "shrink",
    });
  });

  await pptx.writeFile({ fileName: `${filename}.pptx` });
}

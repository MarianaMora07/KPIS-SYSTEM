"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText, ChevronDown, Presentation } from "lucide-react";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import { exportToExcel, exportToPdf, exportToPptx } from "@/modules/dashboard/utils/export-report";
import { DEMO_DASHBOARD_DATA, filterDemoData } from "@/modules/dashboard/data/demo-data";

export function ExportReportButton({ disabled }: { disabled?: boolean }) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchData(): Promise<DashboardKpiRow[]> {
    const params = new URLSearchParams(searchParams.toString());
    const res = await fetch(`/api/dashboard?${params.toString()}`);

    if (res.ok) {
      return res.json();
    }

    return filterDemoData(DEMO_DASHBOARD_DATA, {
      regionId: params.get("region") ?? undefined,
      hotelId: params.get("hotel") ?? undefined,
      fechaDesde: params.get("desde") ?? "2026-06-01",
      fechaHasta: params.get("hasta") ?? "2026-06-30",
    });
  }

  async function handleExport(type: "pdf" | "excel" | "pptx") {
    setLoading(true);
    setOpen(false);
    try {
      const rows = await fetchData();
      const periodo = searchParams.get("periodo") ?? "Jun 2026";
      const region = searchParams.get("region") ?? "";
      const hotel = searchParams.get("hotel") ?? "";
      const timestamp = new Date().toISOString().slice(0, 10);

      let summary: string | null = null;
      if (type === "pdf" || type === "pptx") {
        try {
          const summaryRes = await fetch("/api/reportes/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows,
              filters: { periodo, region, hotel },
            }),
          });
          if (summaryRes.ok) {
            const data = await summaryRes.json();
            summary = data.summary ?? null;
          }
        } catch {
          // Sin resumen IA si falla
        }
      }

      if (type === "pdf") {
        exportToPdf(
          rows,
          { periodo, region, hotel },
          `reporte-ejecutivo-${timestamp}`,
          summary
        );
      } else if (type === "pptx") {
        await exportToPptx(
          rows,
          { periodo, region, hotel },
          `reporte-ejecutivo-${timestamp}`,
          summary
        );
      } else {
        exportToExcel(rows, `reporte-kpis-${timestamp}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading || disabled}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-imperial-900 backdrop-blur-sm transition-colors hover:border-imperial-700/30 hover:bg-imperial-900/5 disabled:opacity-60"
      >
        <Download className="h-4 w-4 text-amber-600" />
        {loading ? "Exportando…" : "Exportar reporte"}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-red-500" />
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("excel")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Descargar Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("pptx")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Presentation className="h-4 w-4 text-orange-600" />
            Descargar PowerPoint
          </button>
        </div>
      )}
    </div>
  );
}

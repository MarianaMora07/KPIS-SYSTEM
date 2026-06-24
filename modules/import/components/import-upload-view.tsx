"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Upload, CheckCircle, XCircle, Loader2, Download, Sparkles, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as XLSX from "xlsx";
import { usePermissions } from "@/components/layout/permissions-context";
import { EXPECTED_COLUMNS, formatExpectedColumnsHelp } from "@/modules/import/constants";

function validateFileHeaders(headers: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  if (!normalized.includes("kpi_codigo")) {
    return "Falta columna obligatoria: kpi_codigo";
  }
  if (!normalized.includes("fecha")) {
    return "Falta columna obligatoria: fecha";
  }
  const hasReal = normalized.includes("valor_real");
  const hasVars = normalized.some((col) => col.startsWith("var_"));
  if (!hasReal && !hasVars) {
    return "Debe incluir la columna valor_real o al menos una columna de variable (var_...)";
  }
  return null;
}

async function readFileHeaders(file: File): Promise<string[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (ext === "csv") {
    const text = new TextDecoder().decode(buffer);
    const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
    return firstLine.split(",").map((h) => h.trim());
  }
  const wb = XLSX.read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  return (rows[0] ?? []).map((h) => String(h).trim());
}

async function transformFileHeaders(
  file: File,
  mapping: Record<string, string>
): Promise<File> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === "csv") {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return file;
    
    const headers = lines[0].split(",").map((h) => h.trim());
    const mappedHeaders = headers.map((h) => mapping[h] || h);
    lines[0] = mappedHeaders.join(",");
    const newText = lines.join("\n");
    const blob = new Blob([newText], { type: "text/csv" });
    return new File([blob], file.name, { type: file.type });
  } else {
    const wb = XLSX.read(buffer);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    
    if (ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const R = 0;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        const cell = ws[cell_ref];
        if (cell && (cell.t === "s" || cell.v !== undefined)) {
          const originalVal = String(cell.v).trim();
          if (mapping[originalVal]) {
            cell.v = mapping[originalVal];
            if (cell.w) delete cell.w;
          }
        }
      }
    }
    const newBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([newBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return new File([blob], file.name, { type: file.type });
  }
}

type JobStatus = "pendiente" | "procesando" | "completado" | "fallido" | "parcial";

interface KpiCatalogEntry {
  codigo: string;
  nombre: string;
}

interface VariableEntry {
  codigo: string;
  nombre: string;
}

interface JobResult {
  id: string;
  estado: JobStatus;
  total_filas: number;
  filas_ok: number;
  filas_error: number;
  nombre_archivo: string;
  import_job_errors?: { fila: number; columna: string | null; mensaje: string }[];
}

export function ImportUploadView({
  kpis = [],
  variables = [],
}: {
  kpis?: KpiCatalogEntry[];
  variables?: VariableEntry[];
}) {
  const { can } = usePermissions();
  const canImport = can("import.cargar");
  const [job, setJob] = useState<JobResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Record<string, string | number>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── AI Column Mapping state (HU-KPI-004) ───────────────────────────
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [autoMapping, setAutoMapping] = useState(false);
  const [mappingToast, setMappingToast] = useState<string | null>(null);
  const [needsMapping, setNeedsMapping] = useState(false);
  const selectedFileRef = useRef<File | null>(null);

  const targetColumns = useMemo(() => [
    { value: "kpi_codigo", label: "Código de KPI (kpi_codigo) - Obligatorio" },
    { value: "fecha", label: "Fecha (fecha) - Obligatorio" },
    { value: "valor_real", label: "Valor real (valor_real)" },
    { value: "hotel_codigo", label: "Código de hotel (hotel_codigo)" },
    { value: "valor_meta", label: "Valor meta (valor_meta)" },
    ...(variables ?? []).map((v) => ({
      value: `var_${v.codigo}`,
      label: `Variable: ${v.nombre} (var_${v.codigo})`,
    })),
  ], [variables]);

  const parsePreview = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();
    if (ext === "csv") {
      const text = new TextDecoder().decode(buffer);
      const lines = text.split("\n").filter(Boolean).slice(0, 6);
      const headers = lines[0]?.split(",") ?? [];
      setPreview(
        lines.slice(1, 6).map((line) => {
          const vals = line.split(",");
          const row: Record<string, string | number> = {};
          headers.forEach((h, i) => {
            row[h.trim()] = vals[i]?.trim() ?? "";
          });
          return row;
        })
      );
    } else {
      const wb = XLSX.read(buffer);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
      setPreview(rows.slice(0, 5));
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`/api/import/${jobId}`);
      if (!res.ok) break;
      const data: JobResult = await res.json();
      setJob(data);
      if (data.estado !== "pendiente" && data.estado !== "procesando") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, []);

  const triggerAiMapping = useCallback(
    async (headers: string[], initialMap?: Record<string, string>) => {
      if (headers.length === 0) return;
      setAutoMapping(true);
      setMappingToast(null);
      console.log("[Client Auto-Map] Starting auto-mapping...", { headers, targetColumns });
      try {
        const res = await fetch("/api/import/map-headers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headers, targetColumns }),
        });
        console.log("[Client Auto-Map] HTTP Response status:", res.status);
        const data = (await res.json().catch(() => ({}))) as {
          mapping?: Record<string, string>;
          mappedCount?: number;
          error?: string;
        };
        console.log("[Client Auto-Map] HTTP Response body:", data);
        if (!res.ok || data.error) throw new Error(data.error ?? "Error al mapear");
        if (data.mapping) {
          setHeaderMapping((prev) => ({ ...prev, ...initialMap, ...data.mapping }));
          const count = data.mappedCount ?? 0;
          setMappingToast(
            count > 0
              ? `Se han mapeado ${count} columna${count !== 1 ? "s" : ""} automáticamente con IA`
              : "La IA no encontró coincidencias para columnas restantes. Mapee manualmente."
          );
          setTimeout(() => setMappingToast(null), 5000);
        }
      } catch (e) {
        console.error("[Client Auto-Map] Error occurred:", e);
        setMappingToast(
          e instanceof Error ? e.message : "Error al auto-mapear. Intente de nuevo."
        );
        setTimeout(() => setMappingToast(null), 5000);
      } finally {
        setAutoMapping(false);
      }
    },
    [targetColumns]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!canImport) return;
      setError(null);
      setJob(null);
      setUploading(true);
      setFileHeaders([]);
      setHeaderMapping({});
      setMappingToast(null);
      setNeedsMapping(false);
      selectedFileRef.current = file;

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "xlsx" && ext !== "csv") {
        setError("Solo se permiten archivos .xlsx o .csv");
        setUploading(false);
        return;
      }

      await parsePreview(file);

      if (file.size > 5 * 1024 * 1024) {
        setError("El archivo no puede superar 5 MB");
        setUploading(false);
        return;
      }

      const headers = await readFileHeaders(file);
      setFileHeaders(headers);

      // Check if headers already match expected columns
      const headerError = validateFileHeaders(headers);
      if (!headerError) {
        // Headers are already valid! Proceed to upload immediately.
        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/import", { method: "POST", body: formData });
          const data = await res.json();

          if (!res.ok) throw new Error(data.error ?? "Error al subir");

          const jobResult = data as JobResult;
          setJob(jobResult);

          if (
            jobResult.id &&
            (jobResult.estado === "pendiente" || jobResult.estado === "procesando")
          ) {
            await pollJob(jobResult.id);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error al importar");
        } finally {
          setUploading(false);
        }
      } else {
        // Headers are invalid/custom. We show the mapping UI and let the user auto-map or manually map.
        setNeedsMapping(true);
        setUploading(false);

        // Initialize mapping with guesses
        const initialMapping: Record<string, string> = {};
        for (const h of headers) {
          const norm = h.toLowerCase().trim();
          if (norm === "kpi_codigo" || norm === "id_indicador" || norm === "indicador" || norm === "código kpi" || norm === "codigo_kpi" || norm === "kpi") {
            initialMapping[h] = "kpi_codigo";
          } else if (norm === "fecha" || norm === "fecha_registro" || norm === "registro_fecha" || norm === "fecha registro") {
            initialMapping[h] = "fecha";
          } else if (norm === "valor_real" || norm === "registro_actual" || norm === "valor" || norm === "real" || norm === "registro actual") {
            initialMapping[h] = "valor_real";
          } else if (norm === "hotel_codigo" || norm === "sucursal_codigo" || norm === "hotel" || norm === "sucursal" || norm === "hotel codigo" || norm === "sucursal codigo") {
            initialMapping[h] = "hotel_codigo";
          } else if (norm === "valor_meta" || norm === "meta_fijada" || norm === "meta" || norm === "valor meta" || norm === "meta fijada") {
            initialMapping[h] = "valor_meta";
          } else if (norm.startsWith("var_")) {
            initialMapping[h] = norm;
          } else {
            initialMapping[h] = "";
          }
        }
        setHeaderMapping(initialMapping);

        // Trigger AI auto-mapping to refine/verify
        triggerAiMapping(headers, initialMapping);
      }
    },
    [pollJob, parsePreview, canImport, triggerAiMapping]
  );

  async function handleImportWithMapping() {
    const file = selectedFileRef.current;
    if (!file) return;

    setError(null);
    setJob(null);
    setUploading(true);

    // 1. Validate mapping
    const values = Object.values(headerMapping);
    if (!values.includes("kpi_codigo")) {
      setError("Debe asignar qué columna del archivo representa al 'Código de KPI' (kpi_codigo).");
      setUploading(false);
      return;
    }
    if (!values.includes("fecha")) {
      setError("Debe asignar qué columna del archivo representa a la 'Fecha' (fecha).");
      setUploading(false);
      return;
    }
    const hasReal = values.includes("valor_real");
    const hasVars = values.some((val) => val.startsWith("var_"));
    if (!hasReal && !hasVars) {
      setError("Debe asignar al menos una columna para 'Valor Real' o alguna variable (var_...).");
      setUploading(false);
      return;
    }

    try {
      console.log("[Client Mapping] Transforming headers with mapping:", headerMapping);
      const transformedFile = await transformFileHeaders(file, headerMapping);

      const formData = new FormData();
      formData.append("file", transformedFile);

      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Error al subir");

      const jobResult = data as JobResult;
      setJob(jobResult);
      setNeedsMapping(false);

      if (
        jobResult.id &&
        (jobResult.estado === "pendiente" || jobResult.estado === "procesando")
      ) {
        await pollJob(jobResult.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleAutoMap() {
    triggerAiMapping(fileHeaders);
  }

  return (
    <div className="space-y-6">
      {/* Mapping Success / Error Toast */}
      <AnimatePresence>
        {mappingToast && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-lg"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <span>{mappingToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {!canImport && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No tiene permiso para importar archivos.
        </p>
      )}
      <div className="flex justify-end">
        <a
          href="/api/import/template"
          className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900"
        >
          <Download className="h-4 w-4" />
          Plantilla Excel
        </a>
      </div>
      <div
        onDragOver={(e) => {
          if (!canImport) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => canImport && inputRef.current?.click()}
        className={`glass rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          !canImport
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : dragOver
              ? "cursor-pointer border-amber-400 bg-amber-50/50"
              : "cursor-pointer border-slate-200 hover:border-amber-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          disabled={!canImport}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
        {uploading ? (
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-amber-600" />
        ) : (
          <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        )}
        <p className="text-sm font-medium text-imperial-900">
          {uploading ? "Subiendo archivo…" : "Arrastre un archivo Excel o CSV"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Máximo 5 MB · Columnas: {formatExpectedColumnsHelp()}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {/* ── AI Column Mapper (HU-KPI-004) ────────────────────────────── */}
      {fileHeaders.length > 0 && (
        <div className="glass overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/60 to-violet-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-900">
                Mapeo de Columnas IA
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                {fileHeaders.length} columnas detectadas
              </span>
            </div>
            <button
              type="button"
              id="btn-auto-mapear-ia"
              onClick={handleAutoMap}
              disabled={autoMapping}
              className="flex items-center gap-2 rounded-xl border border-indigo-300 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {autoMapping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {autoMapping ? "Mapeando…" : "Auto-Mapear con IA"}
            </button>
          </div>
          <div className="overflow-x-auto px-5 py-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-indigo-100 text-left text-indigo-600">
                  <th className="pb-2 pr-4 font-semibold">Columna del archivo</th>
                  <th className="pb-2 font-semibold">Columna destino en el sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50">
                {fileHeaders.map((header) => (
                  <tr key={header}>
                    <td className="py-1.5 pr-4 font-mono text-slate-700">{header}</td>
                    <td className="py-1.5">
                      <select
                        value={headerMapping[header] ?? ""}
                        onChange={(e) =>
                          setHeaderMapping((prev) => ({ ...prev, [header]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-indigo-200 bg-white/80 px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      >
                        <option value="">— Sin asignar / Ignorar —</option>
                        {targetColumns.map((col) => (
                          <option key={col.value} value={col.value}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {needsMapping && (
            <div className="flex justify-end border-t border-indigo-100/60 bg-indigo-50/30 px-5 py-3.5">
              <button
                type="button"
                id="btn-confirmar-importar"
                onClick={handleImportWithMapping}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {uploading ? "Procesando importación…" : "Confirmar e Importar"}
              </button>
            </div>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <div className="glass rounded-xl border border-slate-200/60 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Vista previa (primeras filas)
          </p>
          <div className="overflow-x-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  {Object.keys(preview[0]).map((k) => (
                    <th key={k} className="px-2 py-1">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-2 py-1">
                        {String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {job && <JobStatusCard job={job} />}
    </div>
  );
}

function JobStatusCard({ job }: { job: JobResult }) {
  const isProcessing = job.estado === "pendiente" || job.estado === "procesando";
  const isSuccess = job.estado === "completado" || job.estado === "parcial";
  const isFailed = job.estado === "fallido";

  return (
    <div className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-center gap-3">
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}
        {isSuccess && <CheckCircle className="h-5 w-5 text-green-600" />}
        {isFailed && <XCircle className="h-5 w-5 text-red-600" />}
        <div>
          <p className="font-medium text-imperial-900">{job.nombre_archivo}</p>
          <p className="text-sm text-slate-500">
            {isProcessing
              ? "Procesando…"
              : `Estado: ${job.estado}`}
          </p>
        </div>
      </div>

      {!isProcessing && (
        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <Stat label="Total filas" value={job.total_filas} />
          <Stat label="Correctas" value={job.filas_ok} className="text-green-600" />
          <Stat label="Errores" value={job.filas_error} className="text-red-600" />
        </div>
      )}

      {isFailed && job.total_filas === 0 && !job.import_job_errors?.length && (
        <p className="text-sm text-red-600">
          El procesamiento falló antes de leer filas. Verifique permisos de storage y que la
          plantilla use códigos KPI y hoteles existentes.
        </p>
      )}

      {job.import_job_errors && job.import_job_errors.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Errores por fila
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {job.import_job_errors.map((err, i) => (
              <li key={i} className="rounded bg-red-50 px-3 py-1.5 text-red-700">
                {err.fila > 0 ? `Fila ${err.fila}` : "General"}
                {err.columna && ` (${err.columna})`}: {err.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div>
      <p className={`text-2xl font-semibold ${className ?? "text-imperial-900"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

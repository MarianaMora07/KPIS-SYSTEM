"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { usePermissions } from "@/components/layout/permissions-context";
import { EXPECTED_COLUMNS, formatExpectedColumnsHelp } from "@/modules/import/constants";

const REQUIRED_COLUMNS = ["kpi_codigo", "fecha", "valor_real"] as const;

function validateFileHeaders(headers: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const missing = REQUIRED_COLUMNS.filter((col) => !normalized.includes(col));
  if (missing.length > 0) {
    return `Faltan columnas obligatorias: ${missing.join(", ")}. Se esperan: ${EXPECTED_COLUMNS.join(", ")}`;
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

type JobStatus = "pendiente" | "procesando" | "completado" | "fallido" | "parcial";

interface JobResult {
  id: string;
  estado: JobStatus;
  total_filas: number;
  filas_ok: number;
  filas_error: number;
  nombre_archivo: string;
  import_job_errors?: { fila: number; columna: string | null; mensaje: string }[];
}

export function ImportUploadView() {
  const { can } = usePermissions();
  const canImport = can("import.cargar");
  const [job, setJob] = useState<JobResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Record<string, string | number>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = useCallback(
    async (file: File) => {
      if (!canImport) return;
      setError(null);
      setJob(null);
      setUploading(true);

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
      const headerError = validateFileHeaders(headers);
      if (headerError) {
        setError(headerError);
        setUploading(false);
        return;
      }

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
    },
    [pollJob, parsePreview, canImport]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-6">
      {!canImport && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No tiene permiso para importar archivos.
        </p>
      )}
      <div className="flex justify-end">
        <link
          href="/api/import/template"
          className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900"
        >
          <Download className="h-4 w-4" />
          Plantilla Excel
        </link>
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

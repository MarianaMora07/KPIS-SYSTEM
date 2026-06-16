import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";

interface ImportRow {
  kpi_codigo: string;
  fecha: string;
  valor_real: number;
  hotel_codigo?: string;
  valor_meta?: number;
}

interface ProcessResult {
  total: number;
  ok: number;
  errors: number;
}

export async function processImportJob(jobId: string): Promise<ProcessResult> {
  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .update({ estado: "procesando", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .select()
    .single();

  if (jobError || !job) throw new Error(jobError?.message ?? "Job no encontrado");

  try {
    if (!job.storage_path) throw new Error("Archivo no encontrado");

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("imports")
      .download(job.storage_path);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "No se pudo descargar el archivo");
    }

    const buffer = await fileData.arrayBuffer();
    const rows = parseFile(buffer, job.tipo_archivo as "xlsx" | "csv");

    const { data: kpis } = await supabase.from("kpis").select("id, codigo, meta, hotel_id, region_id");
    const { data: hotels } = await supabase.from("hotels").select("id, codigo, region_id");

    const kpiByCode = new Map((kpis ?? []).map((k) => [k.codigo.toUpperCase(), k]));
    const hotelByCode = new Map((hotels ?? []).map((h) => [h.codigo.toUpperCase(), h]));

    let ok = 0;
    const errors: { fila: number; columna?: string; valor?: string; mensaje: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      const validation = validateRow(row, rowNum);
      if (validation) {
        errors.push(validation);
        continue;
      }

      const kpi = kpiByCode.get(row.kpi_codigo.toUpperCase());
      if (!kpi) {
        errors.push({
          fila: rowNum,
          columna: "kpi_codigo",
          valor: row.kpi_codigo,
          mensaje: `KPI no encontrado: ${row.kpi_codigo}`,
        });
        continue;
      }

      let hotelId = kpi.hotel_id;
      let regionId = kpi.region_id;

      if (row.hotel_codigo) {
        const hotel = hotelByCode.get(row.hotel_codigo.toUpperCase());
        if (!hotel) {
          errors.push({
            fila: rowNum,
            columna: "hotel_codigo",
            valor: row.hotel_codigo,
            mensaje: `Hotel no encontrado: ${row.hotel_codigo}`,
          });
          continue;
        }
        hotelId = hotel.id;
        regionId = hotel.region_id;
      }

      const { error: insertError } = await supabase.from("kpi_values").insert({
        kpi_id: kpi.id,
        hotel_id: hotelId,
        region_id: regionId,
        fecha: row.fecha,
        valor_real: row.valor_real,
        valor_meta: row.valor_meta ?? kpi.meta ?? null,
        fuente: "import",
      });

      if (insertError) {
        errors.push({
          fila: rowNum,
          mensaje: insertError.message,
        });
      } else {
        ok++;
      }
    }

    if (errors.length > 0) {
      await supabase.from("import_job_errors").insert(
        errors.map((e) => ({
          import_job_id: jobId,
          fila: e.fila,
          columna: e.columna ?? null,
          valor: e.valor ?? null,
          mensaje: e.mensaje,
        }))
      );
    }

    const estado =
      ok === 0 && errors.length > 0
        ? "fallido"
        : errors.length > 0
          ? "parcial"
          : "completado";

    await supabase
      .from("import_jobs")
      .update({
        estado,
        total_filas: rows.length,
        filas_ok: ok,
        filas_error: errors.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const event = estado === "fallido" ? "import.failed" : "import.completed";
    await dispatchActivepiecesEvent(event, {
      jobId,
      estado,
      totalFilas: rows.length,
      filasOk: ok,
      filasError: errors.length,
      nombreArchivo: job.nombre_archivo,
    });

    return { total: rows.length, ok, errors: errors.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    await supabase
      .from("import_jobs")
      .update({
        estado: "fallido",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await dispatchActivepiecesEvent("import.failed", { jobId, error: message });
    throw e;
  }
}

function parseFile(buffer: ArrayBuffer, tipo: "xlsx" | "csv"): ImportRow[] {
  const workbook =
    tipo === "csv"
      ? XLSX.read(new TextDecoder().decode(buffer), { type: "string" })
      : XLSX.read(buffer, { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return raw.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      normalized[key.toLowerCase().trim()] = val;
    }
    return {
      kpi_codigo: String(normalized.kpi_codigo ?? "").trim(),
      fecha: normalizeDate(normalized.fecha),
      valor_real: Number(normalized.valor_real),
      hotel_codigo: normalized.hotel_codigo
        ? String(normalized.hotel_codigo).trim()
        : undefined,
      valor_meta: normalized.valor_meta
        ? Number(normalized.valor_meta)
        : undefined,
    };
  });
}

function normalizeDate(val: unknown): string {
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return str;
}

function validateRow(
  row: ImportRow,
  fila: number
): { fila: number; columna?: string; valor?: string; mensaje: string } | null {
  if (!row.kpi_codigo) {
    return { fila, columna: "kpi_codigo", mensaje: "kpi_codigo es requerido" };
  }
  if (!row.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) {
    return { fila, columna: "fecha", valor: row.fecha, mensaje: "fecha inválida (YYYY-MM-DD)" };
  }
  if (isNaN(row.valor_real)) {
    return { fila, columna: "valor_real", mensaje: "valor_real debe ser numérico" };
  }
  return null;
}

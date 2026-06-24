"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Database, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { formatKpiValue } from "@/modules/dashboard/types";

interface PreviewRecord {
  fecha: string;
  variables?: Record<string, number>;
  valor?: number;
  valor_calculado?: number;
  hotel_codigo?: string;
}

interface KpiSqlLoadButtonProps {
  kpiId: string;
  unidadMedida?: string;
  variant?: "form" | "standalone";
  onPrefill?: (data: {
    fecha: string;
    variables: Record<string, number>;
  }) => void;
}

function formatPreviewSummary(
  records: PreviewRecord[],
  mode: "single" | "all",
  unidadMedida?: string
): { title: string; description: string; detail: ReactNode } {
  if (records.length === 0) {
    return {
      title: "Sin datos para cargar",
      description: "La consulta no devolvió filas. Revise la fuente SQL.",
      detail: null,
    };
  }

  const first = records[0]!;
  const valor =
    first.valor_calculado ?? first.valor ?? Object.values(first.variables ?? {})[0];
  const varsText = first.variables
    ? Object.entries(first.variables)
        .map(([k, v]) => `${k} = ${v}`)
        .join(", ")
    : null;

  if (mode === "single") {
    return {
      title: "Confirmar carga desde base de datos",
      description: "Se importará el registro más reciente según el ORDER BY de su consulta.",
      detail: (
        <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Fecha</dt>
            <dd className="font-medium text-imperial-900">{first.fecha}</dd>
          </div>
          {first.hotel_codigo && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Hotel</dt>
              <dd className="font-mono text-xs text-imperial-900">{first.hotel_codigo}</dd>
            </div>
          )}
          {varsText && (
            <div>
              <dt className="text-slate-500">Variables</dt>
              <dd className="mt-0.5 font-mono text-xs text-slate-800">{varsText}</dd>
            </div>
          )}
          {valor != null && (
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
              <dt className="text-slate-500">Valor calculado</dt>
              <dd className="font-semibold text-imperial-900">
                {formatKpiValue(valor, unidadMedida)}
              </dd>
            </div>
          )}
        </dl>
      ),
    };
  }

  const fechas = records.map((r) => r.fecha).sort();
  const minFecha = fechas[0];
  const maxFecha = fechas[fechas.length - 1];

  return {
    title: "Confirmar importación masiva",
    description: `Se importarán hasta ${records.length} fila(s) visibles en la vista previa (máx. 1000 en servidor).`,
    detail: (
      <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Filas en preview</dt>
          <dd className="font-medium text-imperial-900">{records.length}</dd>
        </div>
        {minFecha && maxFecha && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Rango de fechas</dt>
            <dd className="font-medium text-imperial-900">
              {minFecha === maxFecha ? minFecha : `${minFecha} → ${maxFecha}`}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Primera fila (más reciente)</dt>
          <dd className="mt-0.5 text-xs text-slate-700">
            {first.fecha}
            {valor != null && ` · ${formatKpiValue(valor, unidadMedida)}`}
          </dd>
        </div>
      </dl>
    ),
  };
}

export function KpiSqlLoadButton({
  kpiId,
  unidadMedida,
  variant = "standalone",
  onPrefill,
}: KpiSqlLoadButtonProps) {
  const router = useRouter();
  const { showSuccess } = useSuccessToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"single" | "all">("single");
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function fetchPreview(): Promise<PreviewRecord[]> {
    const res = await fetch(`/api/kpis/${kpiId}/sql-source/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al obtener vista previa");
    return (data.records ?? []) as PreviewRecord[];
  }

  function requestLoad(mode: "single" | "all") {
    setError(null);
    if (variant === "form" && mode === "single" && onPrefill) {
      setPreviewLoading(true);
      startTransition(async () => {
        try {
          const records = await fetchPreview();
          const first = records[0];
          if (!first?.variables) {
            setError("La consulta no devolvió variables numéricas");
            return;
          }
          onPrefill({ fecha: first.fecha, variables: first.variables });
          showSuccess(
            `Datos del ${first.fecha} cargados en el formulario (${Object.keys(first.variables).length} variable(s))`
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error al cargar");
        } finally {
          setPreviewLoading(false);
        }
      });
      return;
    }

    setPendingMode(mode);
    setPreviewLoading(true);
    startTransition(async () => {
      try {
        const records = await fetchPreview();
        if (records.length === 0) {
          setError("La consulta no devolvió filas para importar");
          return;
        }
        setPreviewRecords(records);
        setConfirmOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setPreviewLoading(false);
      }
    });
  }

  function executeLoad() {
    startTransition(async () => {
      const res = await fetch(`/api/kpis/${kpiId}/sql-source/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: pendingMode }),
      });
      const data = await res.json();
      setConfirmOpen(false);
      if (!res.ok) {
        setError(data.error ?? "Error al cargar");
        return;
      }

      if (data.loaded > 0) {
        const first = (data.preview ?? data.records?.[0]) as PreviewRecord | undefined;
        showSuccess(
          pendingMode === "all"
            ? `${data.loaded} valor(es) importados desde SQL`
            : first
              ? `Valor del ${first.fecha} importado correctamente`
              : SUCCESS_MESSAGES.created
        );
        router.refresh();
      }
      if (data.errors?.length) {
        setError(data.errors.join("; "));
      }
    });
  }

  const summary = formatPreviewSummary(previewRecords, pendingMode, unidadMedida);
  const isBusy = pending || previewLoading;

  const btnClass =
    variant === "form"
      ? "flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
      : "flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => requestLoad("single")}
          className={btnClass}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          Cargar desde BD
        </button>
        {variant === "standalone" && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => requestLoad("all")}
            className="text-xs text-slate-500 underline"
          >
            Importar todas las filas
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={summary.title}
        description={summary.description}
        confirmLabel={pendingMode === "all" ? "Importar filas" : "Importar registro"}
        cancelLabel="Cancelar"
        variant="default"
        loading={pending}
        onConfirm={executeLoad}
        onCancel={() => setConfirmOpen(false)}
      >
        {summary.detail}
      </ConfirmDialog>
    </>
  );
}

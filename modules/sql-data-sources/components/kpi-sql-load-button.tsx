"use client";

import { useMemo, useState, useTransition } from "react";
import { Database, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/ui/form-modal";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { formatKpiValue } from "@/modules/dashboard/types";
import { SQL_QUERY_LIMIT } from "@/lib/sql/build-structured-query";

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

function recordKey(rec: PreviewRecord): string {
  return `${rec.fecha}|${rec.hotel_codigo ?? ""}`;
}

function formatVariables(rec: PreviewRecord): string {
  if (!rec.variables || Object.keys(rec.variables).length === 0) return "—";
  return Object.entries(rec.variables)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

function recordValue(rec: PreviewRecord): number | undefined {
  return rec.valor_calculado ?? rec.valor ?? Object.values(rec.variables ?? {})[0];
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
  const [selectOpen, setSelectOpen] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([]);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  async function fetchPreview(limit = SQL_QUERY_LIMIT): Promise<{
    records: PreviewRecord[];
    truncated: boolean;
  }> {
    const res = await fetch(`/api/kpis/${kpiId}/sql-source/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al obtener vista previa");
    return {
      records: (data.records ?? []) as PreviewRecord[],
      truncated: Boolean(data.truncated),
    };
  }

  function openSelectionDialog() {
    setError(null);
    setPreviewLoading(true);
    startTransition(async () => {
      try {
        const { records, truncated } = await fetchPreview();
        if (records.length === 0) {
          setError("La consulta no devolvió filas para importar");
          return;
        }
        setPreviewRecords(records);
        setPreviewTruncated(truncated);
        setSelectedKeys(new Set());
        setSelectOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setPreviewLoading(false);
      }
    });
  }

  function requestImportAll() {
    setError(null);
    setPreviewLoading(true);
    startTransition(async () => {
      try {
        const { records } = await fetchPreview(1);
        if (records.length === 0) {
          setError("La consulta no devolvió filas para importar");
          return;
        }
        setConfirmAllOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setPreviewLoading(false);
      }
    });
  }

  function requestFormPrefill() {
    setError(null);
    setPreviewLoading(true);
    startTransition(async () => {
      try {
        const { records } = await fetchPreview(1);
        const first = records[0];
        if (!first?.variables) {
          setError("La consulta no devolvió variables numéricas");
          return;
        }
        onPrefill?.({ fecha: first.fecha, variables: first.variables });
        showSuccess(
          `Datos del ${first.fecha} cargados en el formulario (${Object.keys(first.variables).length} variable(s))`
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setPreviewLoading(false);
      }
    });
  }

  function toggleRow(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (selectedKeys.size === previewRecords.length) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(previewRecords.map(recordKey)));
  }

  const selectedSelections = useMemo(
    () =>
      previewRecords
        .filter((rec) => selectedKeys.has(recordKey(rec)))
        .map((rec) => ({
          fecha: rec.fecha,
          hotel_codigo: rec.hotel_codigo,
        })),
    [previewRecords, selectedKeys]
  );

  function executeLoad(mode: "all" | "selected", selections?: { fecha: string; hotel_codigo?: string }[]) {
    startTransition(async () => {
      const res = await fetch(`/api/kpis/${kpiId}/sql-source/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, selections }),
      });
      const data = await res.json();
      setSelectOpen(false);
      setConfirmAllOpen(false);
      if (!res.ok) {
        setError(data.error ?? "Error al cargar");
        return;
      }

      if (data.loaded > 0) {
        const first = (data.preview ?? data.records?.[0]) as PreviewRecord | undefined;
        showSuccess(
          mode === "all"
            ? `${data.loaded} valor(es) importados desde SQL`
            : first
              ? `${data.loaded} valor(es) importados correctamente`
              : SUCCESS_MESSAGES.created
        );
        router.refresh();
      }
      if (data.errors?.length) {
        setError(data.errors.join("; "));
      }
    });
  }

  const isBusy = pending || previewLoading;
  const allSelected =
    previewRecords.length > 0 && selectedKeys.size === previewRecords.length;

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
          onClick={variant === "form" ? requestFormPrefill : openSelectionDialog}
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
            onClick={requestImportAll}
            className="text-xs text-slate-500 underline"
          >
            Importar todas las filas
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <FormModal
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
        title="Seleccionar registros a importar"
        subtitle="Marque las filas devueltas por la consulta SQL que desea cargar al indicador."
        maxWidth="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {previewRecords.length} fila(s) disponible(s)
            {previewTruncated ? ` (máximo ${SQL_QUERY_LIMIT} por consulta)` : ""}.
          </p>

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todas las filas"
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-2.5">Fecha</th>
                  <th className="px-3 py-2.5">Hotel</th>
                  <th className="px-3 py-2.5">Variables</th>
                  <th className="px-3 py-2.5">Valor calculado</th>
                </tr>
              </thead>
              <tbody>
                {previewRecords.map((rec) => {
                  const key = recordKey(rec);
                  const valor = recordValue(rec);
                  return (
                    <tr
                      key={key}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                      onClick={() => toggleRow(key)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => toggleRow(key)}
                          aria-label={`Seleccionar ${rec.fecha}`}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-imperial-900">{rec.fecha}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">
                        {rec.hotel_codigo ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">
                        {formatVariables(rec)}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {valor != null ? formatKpiValue(valor, unidadMedida ?? "") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setSelectOpen(false)}
              disabled={pending}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => executeLoad("selected", selectedSelections)}
              disabled={pending || selectedKeys.size === 0}
              className="rounded-xl bg-imperial-900 px-4 py-2 text-sm font-medium text-white hover:bg-imperial-800 disabled:opacity-50"
            >
              {pending
                ? "Importando…"
                : `Importar ${selectedKeys.size} registro(s)`}
            </button>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={confirmAllOpen}
        title="Confirmar importación masiva"
        description={`Se importarán todas las filas devueltas por la consulta SQL (hasta ${SQL_QUERY_LIMIT} registros según los filtros definidos).`}
        confirmLabel="Importar todas las filas"
        cancelLabel="Cancelar"
        variant="default"
        loading={pending}
        onConfirm={() => executeLoad("all")}
        onCancel={() => setConfirmAllOpen(false)}
      />
    </>
  );
}

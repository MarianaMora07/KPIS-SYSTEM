"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/ui/form-modal";
import {
  StructuredSqlBuilder,
  EMPTY_SQL_BUILDER_VALUE,
  type StructuredSqlBuilderValue,
} from "./structured-sql-builder";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { cn } from "@/lib/utils/cn";

interface ConnectionOption {
  id: string;
  nombre: string;
  tipo: string;
}

const WIZARD_STEPS = [
  {
    id: 1,
    title: "Conexión",
    hint: "Elija la base de datos probada en Integraciones.",
  },
  {
    id: 2,
    title: "Consulta SQL",
    hint: "Defina SELECT, FROM y filtros. Use ORDER BY para controlar qué fila es «la más reciente».",
  },
  {
    id: 3,
    title: "Mapeo",
    hint: "Indique qué columnas representan la fecha y el hotel en el resultado.",
  },
  {
    id: 4,
    title: "Ejecutar",
    hint: "Guarde la fuente y pruebe la consulta antes de importar valores al indicador.",
  },
] as const;

function WizardStepper({
  current,
  maxReached,
  onGoTo,
}: {
  current: number;
  maxReached: number;
  onGoTo: (step: number) => void;
}) {
  return (
    <nav aria-label="Pasos de configuración SQL" className="mb-6">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const done = current > step.id;
          const active = current === step.id;
          const reachable = step.id <= maxReached;
          return (
            <li key={step.id} className="flex flex-1 items-start gap-2 sm:flex-col sm:items-center">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onGoTo(step.id)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-green-600 text-white",
                  active && "bg-imperial-900 text-white ring-2 ring-imperial-900/20",
                  !done && !active && reachable && "bg-slate-200 text-slate-700 hover:bg-slate-300",
                  !reachable && "cursor-not-allowed bg-slate-100 text-slate-400"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : step.id}
              </button>
              <div className="min-w-0 sm:text-center">
                <p
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-imperial-900" : "text-slate-600"
                  )}
                >
                  {step.title}
                </p>
                {active && (
                  <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{step.hint}</p>
                )}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className="hidden h-px flex-1 self-center bg-slate-200 sm:mt-4 sm:block" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-slate-600 sm:hidden">{WIZARD_STEPS[current - 1]?.hint}</p>
    </nav>
  );
}

interface KpiSqlSourceFormProps {
  kpiId: string;
  formulaVariableCodes?: string[];
  canEdit?: boolean;
  initialConnections?: ConnectionOption[];
  loadOnMount?: boolean;
  onSaved?: () => void;
}

function KpiSqlSourceForm({
  kpiId,
  formulaVariableCodes = [],
  canEdit = false,
  initialConnections = [],
  loadOnMount = true,
  onSaved,
}: KpiSqlSourceFormProps) {
  const { showSuccess } = useSuccessToast();
  const [connections, setConnections] = useState<ConnectionOption[]>(initialConnections);
  const [connectionId, setConnectionId] = useState("");
  const [sqlValue, setSqlValue] = useState<StructuredSqlBuilderValue>(EMPTY_SQL_BUILDER_VALUE);
  const [hasSource, setHasSource] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [previewSql, setPreviewSql] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(loadOnMount);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadSource = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceRes, connRes] = await Promise.all([
        fetch(`/api/kpis/${kpiId}/sql-source`),
        connections.length === 0
          ? fetch("/api/database-connections")
          : Promise.resolve(null),
      ]);

      if (connRes) {
        const connData = await connRes.json();
        if (connRes.ok && Array.isArray(connData)) {
          setConnections(connData);
        }
      }

      const sourceData = await sourceRes.json();
      if (sourceRes.ok && sourceData && sourceData.connection_id) {
        setHasSource(true);
        setConnectionId(sourceData.connection_id);
        setSqlValue({
          clause_select: sourceData.clause_select ?? "",
          clause_from: sourceData.clause_from ?? "",
          clause_where: sourceData.clause_where ?? "",
          clause_group_by: sourceData.clause_group_by ?? "",
          clause_having: sourceData.clause_having ?? "",
          clause_order_by: sourceData.clause_order_by ?? "",
          distinct_rows: sourceData.distinct_rows ?? false,
          fecha_column: sourceData.fecha_column ?? "fecha",
          hotel_column: sourceData.hotel_column ?? "",
          variable_column_map: sourceData.variable_column_map ?? {},
        });
        setMaxStep(4);
      }
    } catch {
      setError("No se pudo cargar la fuente SQL");
    } finally {
      setLoading(false);
    }
  }, [kpiId, connections.length]);

  useEffect(() => {
    if (loadOnMount) loadSource();
  }, [loadOnMount, loadSource]);

  function validateStep(s: number): string | null {
    if (s === 1 && !connectionId) return "Seleccione una conexión";
    if (s === 2) {
      if (!sqlValue.clause_select.trim()) return "El SELECT es obligatorio";
      if (!sqlValue.clause_from.trim()) return "El FROM es obligatorio";
    }
    if (s === 3 && !sqlValue.fecha_column.trim()) return "Indique la columna de fecha";
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const next = Math.min(step + 1, 4);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSave() {
    const err = validateStep(1) ?? validateStep(2) ?? validateStep(3);
    if (err) {
      setError(err);
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/kpis/${kpiId}/sql-source`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: connectionId,
          ...sqlValue,
          clause_where: sqlValue.clause_where || null,
          clause_group_by: sqlValue.clause_group_by || null,
          clause_having: sqlValue.clause_having || null,
          clause_order_by: sqlValue.clause_order_by || null,
          hotel_column: sqlValue.hotel_column || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al guardar");
        return;
      }
      setHasSource(true);
      setMaxStep(4);
      showSuccess(SUCCESS_MESSAGES.updated);
      onSaved?.();
    });
  }

  function handlePreview() {
    const err = validateStep(1) ?? validateStep(2);
    if (err) {
      setError(err);
      return;
    }
    startTransition(async () => {
      setError(null);
      setPreviewRows(null);
      const res = await fetch(`/api/kpis/${kpiId}/sql-source/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: connectionId,
          ...sqlValue,
          clause_where: sqlValue.clause_where || null,
          clause_group_by: sqlValue.clause_group_by || null,
          clause_having: sqlValue.clause_having || null,
          clause_order_by: sqlValue.clause_order_by || null,
          hotel_column: sqlValue.hotel_column || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error en la consulta");
        return;
      }
      setPreviewSql(data.sql ?? null);
      setPreviewRows(data.rows ?? []);
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/kpis/${kpiId}/sql-source`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al eliminar");
        setDeleteOpen(false);
        return;
      }
      setHasSource(false);
      setSqlValue(EMPTY_SQL_BUILDER_VALUE);
      setConnectionId("");
      setPreviewRows(null);
      setPreviewSql(null);
      setStep(1);
      setMaxStep(1);
      setDeleteOpen(false);
      showSuccess(SUCCESS_MESSAGES.deleted);
      onSaved?.();
    });
  }

  const selectedConnection = connections.find((c) => c.id === connectionId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando configuración…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WizardStepper
        current={step}
        maxReached={maxStep}
        onGoTo={(s) => {
          if (s <= maxStep) {
            setError(null);
            setStep(s);
          }
        }}
      />

      {step === 1 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-imperial-900">1. Conexión a la base de datos</h3>
          <p className="mt-1 text-sm text-slate-600">
            Use la conexión que ya probó en Integraciones. Para Supabase interno configure{" "}
            <code className="text-xs">DATABASE_URL</code> en{" "}
            <code className="text-xs">.env.local</code>.
          </p>
          <label className="mt-4 block text-sm">
            <span className="mb-1 font-medium text-slate-700">Conexión *</span>
            <select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              disabled={!canEdit || pending}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Seleccione conexión…</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo === "supabase_internal" ? "Supabase" : "PostgreSQL"})
                </option>
              ))}
            </select>
          </label>
          {connections.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No hay conexiones.{" "}
              <Link href="/integraciones" className="font-medium underline">
                Crear en Integraciones
              </Link>
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-imperial-900">2. Armar la consulta</h3>
          <div className="mt-3">
            <StructuredSqlBuilder
              value={sqlValue}
              onChange={setSqlValue}
              formulaVariableCodes={formulaVariableCodes}
              disabled={!canEdit || pending}
              section="query"
            />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-imperial-900">3. Mapeo de columnas</h3>
          <p className="mt-1 text-sm text-slate-600">
            Indique qué columnas del resultado corresponden a la fecha del valor y al hotel (si
            aplica).
          </p>
          <div className="mt-3">
            <StructuredSqlBuilder
              value={sqlValue}
              onChange={setSqlValue}
              formulaVariableCodes={formulaVariableCodes}
              disabled={!canEdit || pending}
              section="mapping"
            />
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-imperial-900">4. Guardar y ejecutar</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Conexión</dt>
                <dd className="font-medium text-imperial-900">
                  {selectedConnection?.nombre ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Consulta</dt>
                <dd className="mt-1 font-mono text-xs text-slate-800">
                  SELECT {sqlValue.clause_select || "…"} FROM {sqlValue.clause_from || "…"}
                  {sqlValue.clause_where ? ` WHERE ${sqlValue.clause_where}` : ""}
                  {sqlValue.clause_order_by ? ` ORDER BY ${sqlValue.clause_order_by}` : ""}
                </dd>
              </div>
            </dl>

            {canEdit && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar fuente SQL
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-sm"
                >
                  <Play className="h-4 w-4" />
                  Probar consulta
                </button>
                {hasSource && (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    disabled={pending}
                    className="flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar fuente SQL
                  </button>
                )}
              </div>
            )}
          </div>

          {previewSql && (
            <p className="font-mono text-xs text-slate-500">Ejecutado: {previewSql}</p>
          )}

          {previewRows && previewRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-green-200 bg-green-50/50">
              <p className="border-b border-green-200 px-3 py-2 text-xs font-medium text-green-800">
                {previewRows.length} fila(s) — primeras 10 mostradas
              </p>
              <table className="min-w-full text-left text-xs">
                <thead className="bg-white/80">
                  <tr>
                    {Object.keys(previewRows[0]!).map((col) => (
                      <th key={col} className="px-3 py-2 font-medium text-slate-600">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-green-100">
                      {Object.keys(previewRows[0]!).map((col) => (
                        <td key={col} className="px-3 py-2 font-mono text-slate-800">
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasSource && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              Fuente activa. Use «Cargar desde BD» en la barra superior del indicador para importar
              valores.
            </p>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || pending}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="flex items-center gap-1 rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="¿Quitar fuente SQL de este indicador?"
        description="Se eliminará la configuración de consulta. Los valores ya importados desde SQL permanecerán en el historial del KPI."
        confirmLabel="Quitar fuente"
        cancelLabel="Cancelar"
        variant="danger"
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

interface KpiSqlSourceCardProps {
  kpiId: string;
  kpiNombre: string;
  formulaVariableCodes?: string[];
  canEdit?: boolean;
  initialConnections?: ConnectionOption[];
  initialHasSource?: boolean;
  onConfigured?: () => void;
}

export function KpiSqlSourceCard({
  kpiId,
  kpiNombre,
  formulaVariableCodes = [],
  canEdit = false,
  initialConnections = [],
  initialHasSource = false,
  onConfigured,
}: KpiSqlSourceCardProps) {
  const [open, setOpen] = useState(false);
  const [hasSource, setHasSource] = useState(initialHasSource);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    setHasSource(initialHasSource);
  }, [initialHasSource]);

  function handleOpen() {
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  function handleSaved() {
    setHasSource(true);
    onConfigured?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="glass group flex w-full items-center gap-4 rounded-xl border border-slate-200/60 p-4 text-left transition-colors hover:border-imperial-700/25 hover:bg-slate-50/80"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-imperial-900/10 text-imperial-900">
          <Database className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-imperial-900">
            {hasSource
              ? "Fuente de base de datos configurada"
              : "Carga tu indicador desde base de datos"}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {hasSource
              ? "Edite la conexión y la consulta SQL en 4 pasos guiados."
              : "Conecte una base de datos y defina la consulta para importar valores."}
          </p>
        </div>
        {hasSource && (
          <span className="hidden shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 sm:inline">
            Activa
          </span>
        )}
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-imperial-900" />
      </button>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Cargar desde base de datos"
        subtitle={`Indicador: ${kpiNombre}`}
        maxWidth="xl"
      >
        <KpiSqlSourceForm
          key={formKey}
          kpiId={kpiId}
          formulaVariableCodes={formulaVariableCodes}
          canEdit={canEdit}
          initialConnections={initialConnections}
          loadOnMount
          onSaved={handleSaved}
        />
      </FormModal>
    </>
  );
}

/** @deprecated Use KpiSqlSourceCard */
export function KpiSqlSourcePanel(props: KpiSqlSourceCardProps & { kpiNombre?: string }) {
  return <KpiSqlSourceCard {...props} kpiNombre={props.kpiNombre ?? "KPI"} />;
}

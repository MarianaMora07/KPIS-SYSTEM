"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import {
  FormError,
  FormField,
  FormSecondaryButton,
} from "@/components/ui/form-modal";
import { FormUnitSelect } from "@/components/ui/form-unit-select";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { usePermissions } from "@/components/layout/permissions-context";
import { saveFormulaAction } from "@/modules/formulas/actions/formula-actions";
import { createVariableAction } from "@/modules/formulas/actions/variable-actions";
import { extractUsedSymbols } from "@/modules/formulas/utils/formula-engine";
import type { FormulaVariableRow } from "./kpi-create-formula-step";

interface KpiFormulaEditStepProps {
  kpiId: string;
  kpiNombre: string;
  variables: FormulaVariableRow[];
  onVariablesChange: (variables: FormulaVariableRow[]) => void;
  initialExpresion?: string;
  onBack: () => void;
  onSaved?: () => void;
}

export function KpiFormulaEditStep({
  kpiId,
  kpiNombre,
  variables,
  onVariablesChange,
  initialExpresion = "",
  onBack,
  onSaved,
}: KpiFormulaEditStepProps) {
  const { canManageUsers } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const initialUsed = useMemo(() => extractUsedSymbols(initialExpresion), [initialExpresion]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(initialUsed.filter((c) => variables.some((v) => v.codigo === c)))
  );
  const [expresion, setExpresion] = useState(initialExpresion);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ es_valida: boolean; errores: string[] } | null>(null);
  const [showCreateVariable, setShowCreateVariable] = useState(false);
  const [variableTipo, setVariableTipo] = useState<"simple" | "compuesta">("simple");
  const [variableError, setVariableError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creatingVariable, startCreateVariable] = useTransition();

  // ── AI Translator state (HU-KPI-003) ───────────────────────────────────────
  const [aiDesc, setAiDesc] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!aiError) return;
    const t = setTimeout(() => setAiError(null), 5000);
    return () => clearTimeout(t);
  }, [aiError]);

  const selectedVariables = variables.filter((v) => selectedCodes.has(v.codigo));

  async function handleTranslate() {
    if (!aiDesc.trim() || selectedVariables.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/kpis/translate-formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: aiDesc.trim(),
          variables: selectedVariables.map((v) => ({
            codigo: v.codigo,
            nombre: v.nombre,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        formula?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Error al generar fórmula");
      }
      if (data.formula) {
        setExpresion(data.formula);
        setAiDesc("");
      }
    } catch (e) {
      setAiError(
        e instanceof Error ? e.message : "No se pudo generar la fórmula. Intente de nuevo."
      );
    } finally {
      setAiLoading(false);
    }
  }

  function toggleVariable(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function insertVariable(code: string) {
    setExpresion((prev) => (prev ? `${prev} ${code}` : code));
  }

  function handleCreateVariable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVariableError(null);
    const fd = new FormData(e.currentTarget);
    const selectedTipo = fd.get("tipo") as "simple" | "compuesta";
    startCreateVariable(async () => {
      try {
        const created = await createVariableAction({
          codigo: fd.get("codigo") as string,
          nombre: fd.get("nombre") as string,
          tipo: selectedTipo,
          unidad_medida: (fd.get("unidad_medida") as string) || undefined,
          formula_compuesta:
            selectedTipo === "compuesta"
              ? (fd.get("formula_compuesta") as string)
              : undefined,
        });
        onVariablesChange([...variables, created]);
        setSelectedCodes((prev) => new Set([...prev, created.codigo]));
        setShowCreateVariable(false);
        setVariableTipo("simple");
        showSuccess(SUCCESS_MESSAGES.created);
        e.currentTarget.reset();
      } catch (err) {
        setVariableError(err instanceof Error ? err.message : "Error al crear variable");
      }
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await saveFormulaAction(kpiId, expresion);
        setResult(res.validation);
        if (res.validation.es_valida) {
          showSuccess(SUCCESS_MESSAGES.updated);
          onSaved?.();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar fórmula");
      }
    });
  }

  if (!canManageUsers) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        La edición de fórmulas está reservada a administradores.
      </p>
    );
  }

  return (
    <div className="space-y-5">
        <p className="text-sm text-slate-600">
          Indicador: <span className="font-medium text-imperial-900">{kpiNombre}</span>
        </p>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              1. Seleccione variables del catálogo
            </p>
            <button
              type="button"
              onClick={() => setShowCreateVariable((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {showCreateVariable ? "Ocultar formulario" : "Nueva variable"}
            </button>
          </div>

          {showCreateVariable && (
            <form
              onSubmit={handleCreateVariable}
              className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2"
            >
              <FormField label="Código" name="codigo" required placeholder="codigo_variable" />
              <FormField label="Nombre" name="nombre" required placeholder="Nombre descriptivo" />
              <div className="sm:col-span-2">
                <label className="form-label">Tipo</label>
                <select
                  name="tipo"
                  value={variableTipo}
                  onChange={(e) => setVariableTipo(e.target.value as "simple" | "compuesta")}
                  className="form-input"
                  required
                >
                  <option value="simple">Simple (valor de entrada)</option>
                  <option value="compuesta">Compuesta (fórmula interna)</option>
                </select>
              </div>
              <FormUnitSelect
                label="Unidad de medida"
                name="unidad_medida"
                optional
                placeholder="Opcional"
              />
              {variableTipo === "compuesta" && (
                <div className="sm:col-span-2">
                  <FormField label="Fórmula compuesta" name="formula_compuesta" required>
                    <textarea
                      name="formula_compuesta"
                      placeholder="Ej: reservas_web / visitas_mes"
                      required
                      rows={2}
                      className="form-input font-mono"
                    />
                  </FormField>
                </div>
              )}
              {variableError && (
                <p className="text-sm text-red-600 sm:col-span-2">{variableError}</p>
              )}
              <button
                type="submit"
                disabled={creatingVariable}
                className="rounded-lg bg-imperial-900 px-3 py-1.5 text-sm text-white sm:col-span-2 disabled:opacity-60"
              >
                {creatingVariable ? "Guardando…" : "Guardar variable"}
              </button>
            </form>
          )}

          {variables.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay variables en el catálogo. Cree una con el botón superior.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVariable(v.codigo)}
                  className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                    selectedCodes.has(v.codigo)
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {v.codigo}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── AI Formula Translator (HU-KPI-003) ───────────────────────── */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-indigo-900">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Asistente de Fórmula con IA</span>
          </div>
          
          <textarea
            value={aiDesc}
            onChange={(e) => setAiDesc(e.target.value)}
            disabled={aiLoading}
            rows={2}
            placeholder="Describe la fórmula en lenguaje natural... (ej. promedio de camas ocupadas el mes pasado)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
          />

          {selectedVariables.length === 0 && (
            <p className="text-xs text-indigo-600 font-medium">
              ⚠️ Seleccione al menos una variable en el paso 1 para habilitar el asistente de IA.
            </p>
          )}

          {aiError && (
            <div className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-100">
              {aiError}
            </div>
          )}

          <div className="flex justify-start">
            <FormSecondaryButton
              onClick={handleTranslate}
              disabled={aiLoading || !aiDesc.trim() || selectedVariables.length === 0}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Generando expresión...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span>Generar expresión con IA</span>
                </>
              )}
            </FormSecondaryButton>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">2. Construya la expresión</p>
          <textarea
            value={expresion}
            onChange={(e) => setExpresion(e.target.value)}
            rows={3}
            placeholder="Ej: reservas_web / visitas_mes * 100"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
          />
          {selectedVariables.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs text-slate-500">Insertar:</span>
              {selectedVariables.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => insertVariable(v.codigo)}
                  className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-amber-800 hover:bg-amber-50"
                >
                  {v.codigo}
                </button>
              ))}
            </div>
          )}
        </div>

        {result && (
          <p className={`text-sm ${result.es_valida ? "text-green-600" : "text-red-600"}`}>
            {result.es_valida ? "Fórmula válida" : result.errores.join("; ")}
          </p>
        )}

        {error && <FormError message={error} />}

        <div className="flex gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="btn-gradient flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar fórmula"}
          </button>
          <FormSecondaryButton onClick={onBack}>Volver</FormSecondaryButton>
        </div>
      </div>
  );
}

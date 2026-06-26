"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import {
  FormError,
  FormField,
  FormSecondaryButton,
} from "@/components/ui/form-modal";
import { FormUnitSelect } from "@/components/ui/form-unit-select";
import { GUIDED_SUCCESS, useSuccessToast } from "@/components/ui/success-toast";
import { createVariableAction } from "@/modules/formulas/actions/variable-actions";
import { validateFormula } from "@/modules/formulas/utils/formula-engine";
import {
  KpiFormulaSuggestion,
  type FormulaSuggestionContext,
} from "@/modules/formulas/components/kpi-formula-suggestion";

export interface FormulaVariableRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  unidad_medida?: string | null;
  formula_compuesta?: string | null;
}

interface KpiCreateFormulaStepProps {
  kpiNombre: string;
  kpiContext?: FormulaSuggestionContext;
  variables: FormulaVariableRow[];
  onVariablesChange: (variables: FormulaVariableRow[]) => void;
  usesFormula: boolean | null;
  onUsesFormulaChange: (value: boolean) => void;
  expresion: string;
  onExpresionChange: (value: string) => void;
  selectedCodes: Set<string>;
  onSelectedCodesChange: (codes: Set<string>) => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export function KpiCreateFormulaStep({
  kpiNombre,
  kpiContext,
  variables,
  onVariablesChange,
  usesFormula,
  onUsesFormulaChange,
  expresion,
  onExpresionChange,
  selectedCodes,
  onSelectedCodesChange,
  error,
  pending,
  onBack,
  onSubmit,
}: KpiCreateFormulaStepProps) {
  const { canManageUsers } = usePermissions();
  const { showGuidedSuccess } = useSuccessToast();
  const [showCreateVariable, setShowCreateVariable] = useState(false);
  const [variableTipo, setVariableTipo] = useState<"simple" | "compuesta">("simple");
  const [variableError, setVariableError] = useState<string | null>(null);
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const [creatingVariable, startCreateVariable] = useTransition();

  const selectedVariables = variables.filter((v) => selectedCodes.has(v.codigo));

  function toggleVariable(code: string) {
    onSelectedCodesChange(
      (() => {
        const next = new Set(selectedCodes);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        return next;
      })()
    );
  }

  function insertVariable(code: string) {
    onExpresionChange(expresion ? `${expresion} ${code}` : code);
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
        onSelectedCodesChange(new Set([...selectedCodes, created.codigo]));
        setShowCreateVariable(false);
        setVariableTipo("simple");
        showGuidedSuccess(GUIDED_SUCCESS.variableCreated);
        e.currentTarget.reset();
      } catch (err) {
        setVariableError(err instanceof Error ? err.message : "Error al crear variable");
      }
    });
  }

  function handleSubmitClick() {
    if (usesFormula === null) {
      setValidationHint("Indique si el indicador usará fórmulas.");
      return;
    }
    if (!usesFormula) {
      onSubmit();
      return;
    }
    if (!canManageUsers) {
      setValidationHint(
        "La configuración de fórmulas requiere rol administrador. Elija «Sin fórmula» o contacte a un administrador."
      );
      return;
    }
    if (!expresion.trim()) {
      setValidationHint("Construya la expresión de la fórmula.");
      return;
    }
    const validation = validateFormula(
      expresion,
      variables.map((v) => v.codigo)
    );
    if (!validation.es_valida) {
      setValidationHint(validation.errores.join("; "));
      return;
    }
    setValidationHint(null);
    onSubmit();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Indicador: <span className="font-medium text-imperial-900">{kpiNombre}</span>
      </p>

      <div>
        <p className="form-label">¿Este indicador usará fórmulas?</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onUsesFormulaChange(false);
              setValidationHint(null);
            }}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              usesFormula === false
                ? "border-imperial-700 bg-imperial-900/5 ring-1 ring-imperial-700/30"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-medium text-imperial-900">Sin fórmula</p>
            <p className="mt-1 text-xs text-slate-500">
              El valor se registrará directamente, sin cálculo automático.
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              onUsesFormulaChange(true);
              setValidationHint(null);
            }}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              usesFormula === true
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-medium text-imperial-900">Con fórmula</p>
            <p className="mt-1 text-xs text-slate-500">
              Calcule el indicador a partir de variables del catálogo.
            </p>
          </button>
        </div>
      </div>

      {usesFormula === true && canManageUsers && (
        <>
          <KpiFormulaSuggestion
            context={
              kpiContext ?? {
                kpi_nombre: kpiNombre,
              }
            }
            variables={selectedVariables}
            currentExpresion={expresion}
            currentSelectedCodes={selectedVariables.map((v) => v.codigo)}
            onApply={({ expresion: nextExpresion, variableCodes }) => {
              onExpresionChange(nextExpresion);
              onSelectedCodesChange(
                new Set(
                  variableCodes.filter((code) => variables.some((v) => v.codigo === code))
                )
              );
            }}
            onRestore={({ expresion: prevExpresion, variableCodes }) => {
              onExpresionChange(prevExpresion);
              onSelectedCodesChange(
                new Set(
                  variableCodes.filter((code) => variables.some((v) => v.codigo === code))
                )
              );
            }}
          />

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
                <FormField
                  label="Código"
                  name="codigo"
                  required
                  placeholder="codigo_variable"
                />
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
                {variables.map((v) => {
                  const active = selectedCodes.has(v.codigo);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleVariable(v.codigo)}
                      title={`${v.nombre} · ${v.tipo}`}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                        active
                          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {v.codigo}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">2. Construya la expresión</p>
            <textarea
              value={expresion}
              onChange={(e) => onExpresionChange(e.target.value)}
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
        </>
      )}

      {usesFormula === true && !canManageUsers && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La configuración de fórmulas está reservada a administradores. Puede crear el indicador
          sin fórmula y solicitar su configuración después.
        </p>
      )}

      {usesFormula === false && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          El indicador se creará sin fórmula. Podrá registrar valores manualmente.
        </p>
      )}

      {(error || validationHint) && (
        <FormError message={error ?? validationHint ?? ""} />
      )}

      <div className="flex gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={handleSubmitClick}
          className="btn-gradient flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Creando indicador…" : "Crear KPI"}
        </button>
        <FormSecondaryButton onClick={onBack} disabled={pending}>
          Atrás
        </FormSecondaryButton>
      </div>
    </div>
  );
}

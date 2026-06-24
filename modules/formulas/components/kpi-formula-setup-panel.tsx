"use client";

import { useMemo, useState, useTransition } from "react";
import { Info, X } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { FormModal, FormSecondaryButton } from "@/components/ui/form-modal";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { saveFormulaAction } from "../actions/formula-actions";
import { extractUsedSymbols } from "../utils/formula-engine";
import {
  KpiFormulaSuggestion,
  type FormulaSuggestionContext,
} from "./kpi-formula-suggestion";

interface VariableRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  formula_compuesta?: string | null;
}

const FORMULA_STEPS = [
  "Cree las variables en Variables de fórmula (catálogo global).",
  "Seleccione aquí las variables que usará este indicador.",
  "Construya la expresión e inserte variables con los botones.",
  "Guarde y valide la fórmula (una expresión por indicador, válida para todos los desgloses).",
  "Registre un nuevo valor ingresando cada variable; el KPI se calcula automáticamente.",
  "Use el desglose (hotel, región, canal…) al registrar el valor, no en la fórmula.",
  "Los registros anteriores no se modifican: use Registrar valor para aplicar la fórmula a fechas nuevas.",
];

export function KpiFormulaSetupPanel({
  kpiId,
  kpiNombre,
  kpiContext,
  allVariables,
  initialExpresion = "",
  onFormulaSaved,
  onRequestRegisterValue,
}: {
  kpiId: string;
  kpiNombre: string;
  kpiContext?: FormulaSuggestionContext;
  allVariables: VariableRow[];
  initialExpresion?: string;
  onFormulaSaved?: () => void;
  onRequestRegisterValue?: () => void;
}) {
  const { canManageUsers } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const initialUsed = useMemo(() => extractUsedSymbols(initialExpresion), [initialExpresion]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(initialUsed.filter((c) => allVariables.some((v) => v.codigo === c)))
  );
  const [expresion, setExpresion] = useState(initialExpresion);
  const [helpOpen, setHelpOpen] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [result, setResult] = useState<{ es_valida: boolean; errores: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedVariables = allVariables.filter((v) => selectedCodes.has(v.codigo));

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

  function handleSave() {
    startTransition(async () => {
      try {
        const res = await saveFormulaAction(kpiId, expresion);
        setResult(res.validation);
        if (res.validation.es_valida) {
          setSavedBanner(true);
          showSuccess(SUCCESS_MESSAGES.updated);
          onFormulaSaved?.();
        }
      } catch (err) {
        setResult({
          es_valida: false,
          errores: [err instanceof Error ? err.message : "Error al guardar"],
        });
      }
    });
  }

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Fórmula del indicador — {kpiNombre}
        </h2>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Info className="h-3.5 w-3.5" />
          ¿Cómo funciona?
        </button>
      </div>

      <FormModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Cómo configurar la fórmula"
        subtitle={`Indicador: ${kpiNombre}`}
        maxWidth="md"
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {FORMULA_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
          <FormSecondaryButton onClick={() => setHelpOpen(false)}>
            Cerrar
          </FormSecondaryButton>
        </div>
      </FormModal>

      {savedBanner && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="text-sm text-green-800">
            <p className="font-medium">Fórmula guardada correctamente.</p>
            <p className="mt-1 text-xs">
              Para aplicarla, registre un nuevo valor con las variables requeridas. El sistema
              calculará el resultado automáticamente.
            </p>
          </div>
          <div className="flex gap-2">
            {onRequestRegisterValue && (
              <button
                type="button"
                onClick={onRequestRegisterValue}
                className="rounded-lg bg-imperial-900 px-3 py-1.5 text-xs text-white"
              >
                Registrar valor
              </button>
            )}
            <button
              type="button"
              onClick={() => setSavedBanner(false)}
              className="rounded p-1 text-green-700 hover:bg-green-100"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-slate-500">
          1. Seleccione variables del catálogo
        </p>
        {canManageUsers && (
          <KpiFormulaSuggestion
            context={
              kpiContext ?? {
                kpi_nombre: kpiNombre,
              }
            }
            variables={allVariables}
            currentExpresion={expresion}
            onApply={({ expresion: nextExpresion, variableCodes }) => {
              setExpresion(nextExpresion);
              setSelectedCodes(
                new Set(variableCodes.filter((code) => allVariables.some((v) => v.codigo === code)))
              );
            }}
          />
        )}
        {allVariables.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay variables en el catálogo.{" "}
            <a href="/kpis?tab=variables" className="text-amber-700 hover:underline">
              Crear variables
            </a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allVariables.map((v) => {
              const active = selectedCodes.has(v.codigo);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!canManageUsers}
                  onClick={() => toggleVariable(v.codigo)}
                  title={`${v.nombre} · ${v.tipo}`}
                  className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                    active
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  } disabled:cursor-default disabled:opacity-70`}
                >
                  {v.codigo}
                </button>
              );
            })}
          </div>
        )}
        {selectedVariables.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Seleccionadas: {selectedVariables.map((v) => v.codigo).join(", ")}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">2. Construya la expresión</p>
        <textarea
          value={expresion}
          onChange={(e) => setExpresion(e.target.value)}
          readOnly={!canManageUsers}
          rows={3}
          placeholder="Ej: reservas_web / visitas_mes * 100"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
        />
        {canManageUsers && selectedVariables.length > 0 && (
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
        <p className={`mt-2 text-sm ${result.es_valida ? "text-green-600" : "text-red-600"}`}>
          {result.es_valida ? "Fórmula válida" : result.errores.join("; ")}
        </p>
      )}

      {canManageUsers && (
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="mt-3 rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          Validar y guardar
        </button>
      )}

      {!canManageUsers && initialExpresion && (
        <p className="mt-2 text-xs text-slate-500">Solo lectura</p>
      )}
    </section>
  );
}

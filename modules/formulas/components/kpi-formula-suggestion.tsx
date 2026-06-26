"use client";

import { useState } from "react";
import { Sparkles, RotateCcw, X } from "lucide-react";
import { validateFormula } from "@/modules/formulas/utils/formula-engine";

export interface FormulaSuggestionContext {
  kpi_nombre: string;
  unidad_medida?: string;
  area_responsable?: string;
  tipo_indicador?: string;
}

interface FormulaVariableOption {
  codigo: string;
  nombre: string;
  tipo: string;
}

interface KpiFormulaSuggestionProps {
  context: FormulaSuggestionContext;
  variables: FormulaVariableOption[];
  currentExpresion: string;
  currentSelectedCodes: string[];
  onApply: (payload: { expresion: string; variableCodes: string[] }) => void;
  onRestore: (payload: { expresion: string; variableCodes: string[] }) => void;
  disabled?: boolean;
}

interface SuggestionResponse {
  expresion: string;
  variable_codes: string[];
  reason: string;
  fallback?: boolean;
}

export function KpiFormulaSuggestion({
  context,
  variables,
  currentExpresion,
  currentSelectedCodes,
  onApply,
  onRestore,
  disabled = false,
}: KpiFormulaSuggestionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    expresion: string;
    variableCodes: string[];
  } | null>(null);

  const canSuggest = variables.length > 0;

  async function handleSuggest() {
    if (!canSuggest) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/kpis/suggest-formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...context,
          variables: variables.map((v) => ({
            codigo: v.codigo,
            nombre: v.nombre,
            tipo: v.tipo,
          })),
        }),
      });

      const data = (await res.json()) as SuggestionResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo generar la sugerencia");
      }

      setSuggestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al solicitar sugerencia");
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() {
    setSuggestion(null);
    setError(null);
  }

  function handleApply() {
    if (!suggestion?.expresion?.trim()) return;

    const knownCodes = variables.map((v) => v.codigo);
    const variableCodes =
      suggestion.variable_codes.length > 0
        ? suggestion.variable_codes.filter((code) => knownCodes.includes(code))
        : knownCodes;

    const validation = validateFormula(suggestion.expresion, knownCodes);
    if (!validation.es_valida) {
      setError(validation.errores.join("; "));
      return;
    }

    setUndoSnapshot({
      expresion: currentExpresion,
      variableCodes: currentSelectedCodes,
    });
    onApply({
      expresion: suggestion.expresion.trim(),
      variableCodes,
    });
    setSuggestion(null);
    setError(null);
  }

  function handleUndo() {
    if (!undoSnapshot) return;
    onRestore(undoSnapshot);
    setUndoSnapshot(null);
    setSuggestion(null);
    setError(null);
  }

  const matchesCurrent =
    suggestion?.expresion?.trim() &&
    currentExpresion.trim() === suggestion.expresion.trim();

  return (
    <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-violet-950">Sugerencia con IA</p>
          <p className="mt-0.5 text-xs text-violet-900/80">
            Propone una fórmula según el nombre del indicador y las variables que seleccionó arriba.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || loading || !canSuggest}
          onClick={() => void handleSuggest()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {loading ? "Generando…" : "Sugerir fórmula"}
        </button>
      </div>

      {!canSuggest && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Seleccione al menos una variable en el paso 1. Sin variables, la IA no puede proponer una
          fórmula coherente para este indicador.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {undoSnapshot && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-600">Se aplicó una sugerencia de fórmula.</p>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Restaurar estado anterior
          </button>
        </div>
      )}

      {suggestion && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2">
          {suggestion.expresion ? (
            <>
              <p className="font-mono text-sm text-imperial-900">{suggestion.expresion}</p>
              {suggestion.variable_codes.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Variables: {suggestion.variable_codes.join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">Sin fórmula automática disponible.</p>
          )}
          <p className="mt-2 text-xs text-slate-600">{suggestion.reason}</p>
          {suggestion.fallback && (
            <p className="mt-1 text-xs text-violet-700">
              Sugerencia heurística (IA no disponible o sin respuesta).
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <X className="h-3 w-3" aria-hidden />
              Descartar sugerencia
            </button>
            {suggestion.expresion && !matchesCurrent && (
              <button
                type="button"
                onClick={handleApply}
                className="rounded-lg bg-imperial-900 px-3 py-1.5 text-xs text-white"
              >
                Aplicar sugerencia
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
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
  onApply: (payload: { expresion: string; variableCodes: string[] }) => void;
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
  onApply,
  disabled = false,
}: KpiFormulaSuggestionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);

  async function handleSuggest() {
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

    onApply({
      expresion: suggestion.expresion.trim(),
      variableCodes,
    });
    setSuggestion(null);
    setError(null);
  }

  const matchesCurrent =
    suggestion?.expresion?.trim() &&
    currentExpresion.trim() === suggestion.expresion.trim();

  return (
    <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-violet-950">Sugerencia con IA</p>
          <p className="mt-0.5 text-xs text-violet-900/80">
            Propone una fórmula según el nombre del indicador y las variables del catálogo.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void handleSuggest()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {loading ? "Generando…" : "Sugerir fórmula"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

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
          {suggestion.expresion && !matchesCurrent && (
            <button
              type="button"
              onClick={handleApply}
              className="mt-3 rounded-lg bg-imperial-900 px-3 py-1.5 text-xs text-white"
            >
              Aplicar sugerencia
            </button>
          )}
        </div>
      )}
    </div>
  );
}

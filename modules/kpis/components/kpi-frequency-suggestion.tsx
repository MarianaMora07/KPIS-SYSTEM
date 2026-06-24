"use client";

import { Sparkles } from "lucide-react";
import {
  formatFrequencyLabel,
  suggestKpiFrequency,
  type FrequencySuggestion,
} from "@/lib/kpis/suggest-frequency";
import type { KpiFrequency } from "@/types/database";

interface KpiFrequencySuggestionProps {
  tipoIndicador: string;
  nombre: string;
  unidadMedida: string;
  areaResponsable: string;
  currentFrecuencia: string;
  onApply: (frecuencia: KpiFrequency) => void;
}

export function KpiFrequencySuggestion({
  tipoIndicador,
  nombre,
  unidadMedida,
  areaResponsable,
  currentFrecuencia,
  onApply,
}: KpiFrequencySuggestionProps) {
  const suggestion: FrequencySuggestion | null = suggestKpiFrequency({
    tipo_indicador: tipoIndicador,
    nombre,
    unidad_medida: unidadMedida,
    area_responsable: areaResponsable,
  });

  if (!suggestion) return null;

  const matches = currentFrecuencia === suggestion.suggested;

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm sm:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-medium text-amber-950">
              Frecuencia sugerida: {formatFrequencyLabel(suggestion.suggested)}
            </p>
            <p className="mt-0.5 text-xs text-amber-900/85">{suggestion.reason}</p>
            {suggestion.alternatives.length > 0 && (
              <p className="mt-1 text-xs text-amber-800/75">
                Alternativas:{" "}
                {suggestion.alternatives.map((f) => formatFrequencyLabel(f)).join(", ")}
              </p>
            )}
          </div>
        </div>
        {!matches && (
          <button
            type="button"
            onClick={() => onApply(suggestion.suggested)}
            className="shrink-0 rounded-lg bg-imperial-900 px-3 py-1 text-xs font-medium text-white hover:bg-imperial-800"
          >
            Usar sugerida
          </button>
        )}
      </div>
    </div>
  );
}

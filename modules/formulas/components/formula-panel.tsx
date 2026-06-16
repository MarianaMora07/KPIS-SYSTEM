"use client";

import { useState, useTransition } from "react";
import { usePermissions } from "@/components/layout/permissions-context";
import { saveFormulaAction } from "../actions/formula-actions";

export function FormulaPanel({
  kpiId,
  kpiNombre,
  variableCodes = [],
  initialExpresion = "",
}: {
  kpiId: string;
  kpiNombre: string;
  variableCodes?: string[];
  initialExpresion?: string;
}) {
  const { can } = usePermissions();
  const canEdit = can("kpis.editar");
  const [expresion, setExpresion] = useState(initialExpresion);
  const [result, setResult] = useState<{ es_valida: boolean; errores: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  function insertVariable(code: string) {
    setExpresion((prev) => (prev ? `${prev} ${code}` : code));
  }

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
        Fórmula — {kpiNombre}
      </h2>
      <textarea
        value={expresion}
        onChange={(e) => setExpresion(e.target.value)}
        readOnly={!canEdit}
        rows={3}
        placeholder="Ej: ocupacion * tarifa_promedio"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
      />
      {variableCodes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-xs text-slate-500">Insertar variable:</span>
          {variableCodes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => insertVariable(code)}
              className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-amber-800 hover:bg-amber-50"
            >
              {code}
            </button>
          ))}
        </div>
      )}
      {result && (
        <p
          className={`mt-2 text-sm ${result.es_valida ? "text-green-600" : "text-red-600"}`}
        >
          {result.es_valida ? "Fórmula válida" : result.errores.join("; ")}
        </p>
      )}
      {canEdit && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveFormulaAction(kpiId, expresion);
              setResult(res.validation);
            })
          }
          className="mt-3 rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white"
        >
          Validar y guardar
        </button>
      )}
    </section>
  );
}

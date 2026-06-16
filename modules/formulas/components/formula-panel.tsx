"use client";

import { useState, useTransition } from "react";
import { saveFormulaAction } from "../actions/formula-actions";

export function FormulaPanel({
  kpiId,
  kpiNombre,
}: {
  kpiId: string;
  kpiNombre: string;
}) {
  const [expresion, setExpresion] = useState("");
  const [result, setResult] = useState<{ es_valida: boolean; errores: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
        Fórmula — {kpiNombre}
      </h2>
      <textarea
        value={expresion}
        onChange={(e) => setExpresion(e.target.value)}
        rows={3}
        placeholder="Ej: ocupacion * tarifa_promedio"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
      />
      {result && (
        <p
          className={`mt-2 text-sm ${result.es_valida ? "text-green-600" : "text-red-600"}`}
        >
          {result.es_valida
            ? "Fórmula válida"
            : result.errores.join("; ")}
        </p>
      )}
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
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/layout/permissions-context";
import { createVariableAction } from "../actions/variable-actions";

interface VariableRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

export function VariablesPanel({ variables }: { variables: VariableRow[] }) {
  const { can } = usePermissions();
  const canEdit = can("kpis.editar");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Variables de fórmula
        </h2>
        {canEdit && (
          <button type="button" onClick={() => setOpen(!open)} className="text-xs text-amber-700">
            + Nueva variable
          </button>
        )}
      </div>

      {open && canEdit && (
        <form
          className="mb-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              try {
                await createVariableAction({
                  codigo: fd.get("codigo") as string,
                  nombre: fd.get("nombre") as string,
                  tipo: fd.get("tipo") as "simple" | "compuesta",
                  unidad_medida: (fd.get("unidad_medida") as string) || undefined,
                });
                setOpen(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Error");
              }
            });
          }}
        >
          <input name="codigo" placeholder="codigo_variable" required className="rounded border px-2 py-1 text-sm font-mono" />
          <input name="nombre" placeholder="Nombre" required className="rounded border px-2 py-1 text-sm" />
          <select name="tipo" className="rounded border px-2 py-1 text-sm">
            <option value="simple">Simple</option>
            <option value="compuesta">Compuesta</option>
          </select>
          <input name="unidad_medida" placeholder="Unidad" className="rounded border px-2 py-1 text-sm" />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <button type="submit" disabled={pending} className="rounded bg-imperial-900 px-3 py-1 text-sm text-white sm:col-span-2">
            Guardar variable
          </button>
        </form>
      )}

      <ul className="space-y-1 text-sm">
        {variables.map((v) => (
          <li key={v.id} className="flex justify-between rounded bg-slate-50 px-3 py-2 font-mono text-xs">
            <span>{v.codigo}</span>
            <span className="text-slate-500">{v.nombre} · {v.tipo}</span>
          </li>
        ))}
        {variables.length === 0 && (
          <li className="text-slate-500">No hay variables definidas.</li>
        )}
      </ul>
    </section>
  );
}

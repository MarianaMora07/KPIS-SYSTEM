"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/layout/permissions-context";
import { FormUnitSelect } from "@/components/ui/form-unit-select";
import { createVariableAction } from "../actions/variable-actions";

interface VariableRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  formula_compuesta?: string | null;
}

export function VariablesPanel({ variables }: { variables: VariableRow[] }) {
  const { canManageUsers } = usePermissions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"simple" | "compuesta">("simple");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canManageUsers) {
    return (
      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Variables de fórmula
        </h2>
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

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Variables de fórmula
        </h2>
        <button type="button" onClick={() => setOpen(!open)} className="text-xs text-amber-700">
          + Nueva variable
        </button>
      </div>

      {open && (
        <form
          className="mb-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const selectedTipo = fd.get("tipo") as "simple" | "compuesta";
            startTransition(async () => {
              try {
                await createVariableAction({
                  codigo: fd.get("codigo") as string,
                  nombre: fd.get("nombre") as string,
                  tipo: selectedTipo,
                  unidad_medida: (fd.get("unidad_medida") as string) || undefined,
                  formula_compuesta:
                    selectedTipo === "compuesta"
                      ? (fd.get("formula_compuesta") as string)
                      : undefined,
                });
                setOpen(false);
                setTipo("simple");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Error");
              }
            });
          }}
        >
          <input name="codigo" placeholder="codigo_variable" required className="rounded border px-2 py-1 text-sm font-mono" />
          <input name="nombre" placeholder="Nombre" required className="rounded border px-2 py-1 text-sm" />
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "simple" | "compuesta")}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="simple">Simple</option>
            <option value="compuesta">Compuesta</option>
          </select>
          <div className="sm:col-span-2">
            <FormUnitSelect
              label="Unidad de medida"
              name="unidad_medida"
              optional
              placeholder="Opcional"
            />
          </div>
          {tipo === "compuesta" && (
            <textarea
              name="formula_compuesta"
              placeholder="Ej: reservas_web / visitas_mes"
              required
              rows={2}
              className="rounded border px-2 py-1 font-mono text-sm sm:col-span-2"
            />
          )}
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <button type="submit" disabled={pending} className="rounded bg-imperial-900 px-3 py-1 text-sm text-white sm:col-span-2">
            Guardar variable
          </button>
        </form>
      )}

      <ul className="space-y-1 text-sm">
        {variables.map((v) => (
          <li key={v.id} className="rounded bg-slate-50 px-3 py-2">
            <div className="flex justify-between font-mono text-xs">
              <span>{v.codigo}</span>
              <span className="text-slate-500">{v.nombre} · {v.tipo}</span>
            </div>
            {v.tipo === "compuesta" && v.formula_compuesta && (
              <p className="mt-1 font-mono text-xs text-slate-500">{v.formula_compuesta}</p>
            )}
          </li>
        ))}
        {variables.length === 0 && (
          <li className="text-slate-500">No hay variables definidas.</li>
        )}
      </ul>
    </section>
  );
}

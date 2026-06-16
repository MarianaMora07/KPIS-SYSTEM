"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createTargetAction, deleteTargetAction } from "../actions/targets-actions";

interface TargetsPanelProps {
  kpiId: string;
  targets: Record<string, unknown>[];
}

export function TargetsPanel({ kpiId, targets }: TargetsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  function handleConfirmDelete() {
    if (!toDelete) return;
    startTransition(async () => {
      await deleteTargetAction(kpiId, toDelete);
      setToDelete(null);
    });
  }

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Metas por periodo
        </h2>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-amber-700"
        >
          + Nueva meta
        </button>
      </div>

      {open && (
        <form
          className="mb-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              await createTargetAction(kpiId, {
                kpi_id: kpiId,
                periodo_tipo: fd.get("periodo_tipo") as "mensual",
                fecha_inicio: fd.get("fecha_inicio") as string,
                fecha_fin: fd.get("fecha_fin") as string,
                valor_meta: Number(fd.get("valor_meta")),
              });
              setOpen(false);
            });
          }}
        >
          <select name="periodo_tipo" className="rounded border px-2 py-1 text-sm">
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
          </select>
          <input name="valor_meta" type="number" step="any" placeholder="Meta" required className="rounded border px-2 py-1 text-sm" />
          <input name="fecha_inicio" type="date" required className="rounded border px-2 py-1 text-sm" />
          <input name="fecha_fin" type="date" required className="rounded border px-2 py-1 text-sm" />
          <button type="submit" disabled={pending} className="rounded bg-imperial-900 px-3 py-1 text-sm text-white sm:col-span-2">
            Guardar meta
          </button>
        </form>
      )}

      <ul className="space-y-2 text-sm">
        {targets.map((t) => (
          <li key={t.id as string} className="flex justify-between rounded bg-slate-50 px-3 py-2">
            <span>
              {t.periodo_tipo as string}: {t.fecha_inicio as string} — {t.valor_meta as number}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => setToDelete(t.id as string)}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar meta"
        description="¿Desea eliminar esta meta? El KPI dejará de usarla para el periodo configurado."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={pending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

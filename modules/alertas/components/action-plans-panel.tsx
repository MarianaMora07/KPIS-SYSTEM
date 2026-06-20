"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Circle, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  togglePlanItemAction,
  updatePlanStatusAction,
  deleteActionPlanAction,
} from "../actions/alert-actions";

export interface ActionPlanRow {
  id: string;
  titulo: string;
  estado: string;
  fecha_compromiso: string;
  kpi_nombre?: string;
  responsable_nombre?: string;
  items?: { id: string; descripcion: string; completado: boolean }[];
}

export function ActionPlansPanel({ plans }: { plans: ActionPlanRow[] }) {
  if (plans.length === 0) {
    return (
      <div className="glass rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        No hay planes de acción registrados.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}

function PlanCard({ plan }: { plan: ActionPlanRow }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const total = plan.items?.length ?? 0;
  const done = plan.items?.filter((i) => i.completado).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      try {
        await deleteActionPlanAction(plan.id);
        setConfirmDelete(false);
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "No se pudo eliminar");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      <li className="glass rounded-xl border border-slate-200/60 p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-imperial-900">{plan.titulo}</p>
            <p className="text-xs text-slate-500">
              {plan.kpi_nombre} · Compromiso: {plan.fecha_compromiso}
              {plan.responsable_nombre && ` · ${plan.responsable_nombre}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={plan.estado}
              disabled={pending}
              onChange={(e) =>
                startTransition(() => updatePlanStatusAction(plan.id, e.target.value))
              }
              className="rounded border border-slate-200 px-2 py-1 text-xs"
            >
              <option value="abierto">Abierto</option>
              <option value="en_progreso">En progreso</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
              title="Eliminar plan"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </div>

        {total > 0 && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Progreso ítems</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {plan.items && plan.items.length > 0 && (
          <ul className="space-y-1">
            {plan.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() =>
                      togglePlanItemAction(item.id, !item.completado)
                    )
                  }
                  className="text-slate-400 hover:text-green-600"
                >
                  {item.completado ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
                <span className={item.completado ? "text-slate-400 line-through" : ""}>
                  {item.descripcion}
                </span>
              </li>
            ))}
          </ul>
        )}

        {deleteError && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{deleteError}</p>
        )}
      </li>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar plan de acción"
        description={`¿Eliminar el plan "${plan.titulo}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

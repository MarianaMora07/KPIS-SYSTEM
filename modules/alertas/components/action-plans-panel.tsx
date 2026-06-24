"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, Trash2, ExternalLink } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import {
  togglePlanItemAction,
  updatePlanStatusAction,
  deleteActionPlanAction,
  resolveAlertAction,
} from "../actions/alert-actions";

export interface ActionPlanRow {
  id: string;
  titulo: string;
  estado: string;
  fecha_compromiso: string;
  alert_id?: string | null;
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
  const router = useRouter();
  const { showSuccess } = useSuccessToast();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const total = plan.items?.length ?? 0;
  const done = plan.items?.filter((i) => i.completado).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      try {
        await deleteActionPlanAction(plan.id);
        setConfirmDelete(false);
        showSuccess(SUCCESS_MESSAGES.deleted);
        router.refresh();
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "No se pudo eliminar");
        setConfirmDelete(false);
      }
    });
  }

  function handleResolveAlert() {
    if (!plan.alert_id) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await resolveAlertAction(plan.alert_id!);
        setConfirmResolve(false);
        showSuccess(SUCCESS_MESSAGES.updated);
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "No se pudo resolver la alerta");
        setConfirmResolve(false);
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
            <Link
              href={`/alertas/planes/${plan.id}`}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-imperial-900 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver detalle
            </Link>
            <select
              value={plan.estado}
              disabled={pending}
              onChange={(e) => {
                setActionError(null);
                startTransition(async () => {
                  try {
                    await updatePlanStatusAction(plan.id, e.target.value);
                    router.refresh();
                  } catch (err) {
                    setActionError(
                      err instanceof Error ? err.message : "No se pudo actualizar el plan"
                    );
                  }
                });
              }}
              className="rounded border border-slate-200 px-2 py-1 text-xs"
            >
              <option value="abierto">Abierto</option>
              <option value="en_progreso">En progreso</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            {plan.alert_id && plan.estado !== "completado" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmResolve(true)}
                className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100 disabled:opacity-60"
              >
                Resolver alerta
              </button>
            )}
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
                    startTransition(async () => {
                      try {
                        await togglePlanItemAction(item.id, !item.completado);
                        router.refresh();
                      } catch (err) {
                        setActionError(
                          err instanceof Error ? err.message : "No se pudo actualizar el ítem"
                        );
                      }
                    })
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

        {actionError && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{actionError}</p>
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

      <ConfirmDialog
        open={confirmResolve}
        title="Resolver alerta vinculada"
        description={`¿Marcar como resuelta la alerta asociada a "${plan.titulo}"? Desaparecerá de la lista de alertas abiertas.`}
        confirmLabel="Resolver"
        cancelLabel="Cancelar"
        variant="default"
        loading={pending}
        onConfirm={handleResolveAlert}
        onCancel={() => setConfirmResolve(false)}
      />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, CheckCircle, ArrowUpCircle } from "lucide-react";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import {
  resolveAlertAction,
  escalateAlertAction,
} from "@/modules/alertas/actions/alert-actions";
import type { AlertRow } from "@/modules/alertas/types";
import type { TrafficLightStatus } from "@/types/database";
import { usePermissions } from "@/components/layout/permissions-context";

interface AlertsListProps {
  alerts: AlertRow[];
  isDemo?: boolean;
  onOpenPlan?: (params: {
    kpiId: string;
    kpiNombre: string;
    hotelNombre?: string;
    alertId?: string;
    severidad?: AlertRow["severidad"];
  }) => void;
}

type PendingAction = { type: "resolve" | "escalate"; alert: AlertRow };

export function AlertsList({ alerts, isDemo, onOpenPlan }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <div className="glass rounded-xl border border-dashed border-slate-200 p-12 text-center">
        <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-500" />
        <p className="text-sm text-slate-600">No hay alertas abiertas en este momento.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} isDemo={isDemo} onOpenPlan={onOpenPlan} />
      ))}
    </ul>
  );
}

function AlertCard({
  alert,
  isDemo,
  onOpenPlan,
}: {
  alert: AlertRow;
  isDemo?: boolean;
  onOpenPlan?: AlertsListProps["onOpenPlan"];
}) {
  const { can } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const canManageAlerts = can("alertas.ver");
  const canManagePlans = can("planes.gestionar");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const status: TrafficLightStatus =
    alert.severidad === "critico" ? "incumplimiento" : "riesgo";

  const planParams = {
    kpiId: alert.kpi_id,
    kpiNombre: alert.kpi_nombre ?? "KPI",
    hotelNombre: alert.hotel_nombre,
    alertId: alert.id,
    severidad: alert.severidad,
  };
  const isEscalada = alert.estado === "escalada" || alert.escalada;
  const isTargetAlert =
    !!alert.kpi_target_id || alert.mensaje.startsWith("Meta finalizada:");

  function handleConfirm() {
    if (!pendingAction) return;
    const { type, alert: a } = pendingAction;
    setActionError(null);
    startTransition(async () => {
      try {
        if (type === "resolve") await resolveAlertAction(a.id);
        else await escalateAlertAction(a.id);
        setPendingAction(null);
        showSuccess(SUCCESS_MESSAGES.updated);
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "No se pudo completar la acción");
        setPendingAction(null);
      }
    });
  }

  const dialogCopy =
    pendingAction?.type === "resolve"
      ? {
          title: "Resolver alerta",
          description: `¿Marcar como resuelta la alerta del KPI ${alert.kpi_nombre ?? ""}?`,
          confirmLabel: "Resolver",
          variant: "default" as const,
        }
      : {
          title: "Escalar alerta",
          description: `¿Escalar la alerta del KPI ${alert.kpi_nombre ?? ""}? Se notificará a los responsables vía Activepieces.`,
          confirmLabel: "Escalar",
          variant: "warning" as const,
        };

  return (
    <>
      <li className="glass rounded-xl border border-slate-200/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <TrafficLightGlow status={status} showLabel={false} />
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="font-medium text-imperial-900">
                  {alert.kpi_nombre ?? "KPI"}
                </p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {alert.severidad}
                </span>
                {isEscalada && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Escalada
                  </span>
                )}
                {isTargetAlert && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                    Meta finalizada
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">{alert.mensaje}</p>
              <p className="mt-1 text-xs text-slate-400">
                {alert.hotel_nombre && `${alert.hotel_nombre} · `}
                {new Date(alert.created_at).toLocaleString("es-CO")}
              </p>
              {actionError && (
                <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">{actionError}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isDemo && canManageAlerts && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPendingAction({ type: "resolve", alert })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Resolver
                </button>
                {!isEscalada && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setPendingAction({ type: "escalate", alert })}
                    className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    Escalar
                  </button>
                )}
              </>
            )}
            {canManagePlans && (
              <button
                type="button"
                onClick={() => onOpenPlan?.(planParams)}
                className="flex items-center gap-1 rounded-lg bg-imperial-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-imperial-800"
              >
                Plan de acción
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </li>

      <ConfirmDialog
        open={!!pendingAction}
        title={dialogCopy.title}
        description={dialogCopy.description}
        confirmLabel={dialogCopy.confirmLabel}
        cancelLabel="Cancelar"
        variant={dialogCopy.variant}
        loading={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}

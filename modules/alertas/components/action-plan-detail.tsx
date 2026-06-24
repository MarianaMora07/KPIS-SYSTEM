"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { AuditLogRow } from "@/modules/seguridad/types";
import { updatePlanStatusAction } from "../actions/alert-actions";
import { PlanStatusBadge, getPlanStatusStyle } from "./plan-status-badge";

export interface ActionPlanDetailData {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_compromiso: string;
  created_at: string;
  kpi_nombre?: string;
  kpi_codigo?: string;
  responsable_nombre?: string;
  responsable_email?: string;
  items?: { id: string; descripcion: string; completado: boolean }[];
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

function filterStatusChanges(logs: AuditLogRow[]) {
  return logs
    .filter((log) => {
      const nuevo = log.valor_nuevo as Record<string, unknown> | null;
      const anterior = log.valor_anterior as Record<string, unknown> | null;
      return (
        nuevo?.estado !== undefined && nuevo.estado !== anterior?.estado
      );
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

export function ActionPlanDetail({
  plan,
  auditHistory,
  canEditStatus,
}: {
  plan: ActionPlanDetailData;
  auditHistory: AuditLogRow[];
  canEditStatus: boolean;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(plan.estado);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const statusChanges = useMemo(
    () => filterStatusChanges(auditHistory),
    [auditHistory]
  );

  function handleStatusChange(newStatus: string) {
    if (!canEditStatus || pending) return;
    setCurrentStatus(newStatus);
    setSaveError(null);
    startTransition(async () => {
      try {
        await updatePlanStatusAction(plan.id, newStatus);
        router.refresh();
      } catch (e) {
        setCurrentStatus(plan.estado);
        setSaveError(
          e instanceof Error ? e.message : "Error al actualizar estado"
        );
      }
    });
  }

  const total = plan.items?.length ?? 0;
  const done = plan.items?.filter((i) => i.completado).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/alertas?tab=planes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-imperial-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a planes
      </Link>

      <section className="glass overflow-hidden rounded-xl border border-slate-200/60">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {plan.kpi_codigo && (
                <span className="mb-2 inline-block rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  {plan.kpi_codigo}
                </span>
              )}
              <h1 className="text-2xl font-bold text-imperial-900">
                {plan.titulo}
              </h1>
              {plan.kpi_nombre && (
                <p className="mt-1 text-sm text-slate-500">{plan.kpi_nombre}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {canEditStatus ? (
                <>
                  <select
                    value={currentStatus}
                    disabled={pending}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                  >
                    <option value="abierto">Abierto</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="vencido">Vencido</option>
                  </select>
                  {pending && (
                    <span className="animate-pulse text-[10px] text-slate-500">
                      Guardando…
                    </span>
                  )}
                  {saveError && (
                    <span className="max-w-[200px] text-right text-[10px] text-red-500">
                      {saveError}
                    </span>
                  )}
                </>
              ) : (
                <PlanStatusBadge status={currentStatus} />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Información del plan
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Responsable</p>
            <p className="font-medium text-slate-800">
              {plan.responsable_nombre ?? "—"}
            </p>
            {plan.responsable_email && (
              <p className="text-xs text-slate-500">{plan.responsable_email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Fecha de compromiso</p>
            <p className="font-semibold text-red-600">
              {formatDate(plan.fecha_compromiso)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Fecha de registro</p>
            <p>{formatDate(plan.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Estado actual</p>
            <PlanStatusBadge status={currentStatus} />
          </div>
          {plan.descripcion && (
            <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Descripción
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {plan.descripcion}
              </p>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="mt-6">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Progreso ítems</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {plan.items?.map((item) => (
                <li key={item.id}>
                  {item.completado ? "✓" : "○"} {item.descripcion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Línea de tiempo de ejecución
          <span className="ml-2 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium normal-case text-blue-600">
            audit_logs · HU-KPI-012
          </span>
        </h2>

        <div className="relative">
          <div className="absolute bottom-2 left-[17px] top-2 w-px bg-slate-200" />
          <div className="space-y-5">
            <TimelineEvent
              date={plan.created_at}
              label="Plan creado"
              sublabel="Estado inicial: Abierto"
              statusTo="abierto"
            />
            {statusChanges.map((log) => {
              const nuevo = log.valor_nuevo as Record<string, unknown>;
              const anterior = log.valor_anterior as Record<string, unknown> | null;
              const estadoNuevo = String(nuevo.estado);
              const estadoAnterior = anterior?.estado
                ? String(anterior.estado)
                : null;
              return (
                <TimelineEvent
                  key={log.id}
                  date={log.created_at}
                  label={
                    <>
                      Cambio a <PlanStatusBadge status={estadoNuevo} />
                    </>
                  }
                  sublabel={
                    estadoAnterior
                      ? `Anterior: ${getPlanStatusStyle(estadoAnterior).label}`
                      : "Actualizado por el sistema"
                  }
                  statusTo={estadoNuevo}
                />
              );
            })}
          </div>
        </div>

        {statusChanges.length === 0 && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Los cambios de estado aparecerán aquí automáticamente.
          </p>
        )}
      </section>
    </article>
  );
}

function TimelineEvent({
  date,
  label,
  sublabel,
  statusTo,
}: {
  date: string;
  label: ReactNode;
  sublabel?: string;
  statusTo: string;
}) {
  const s = getPlanStatusStyle(statusTo);

  return (
    <div className="relative flex items-start gap-4">
      <div
        className={`relative z-10 flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full ring-4 ring-white ${s.bg}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
      </div>
      <div className="flex-1 pb-1 pt-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
            {label}
          </div>
          <time className="flex-shrink-0 whitespace-nowrap text-xs text-slate-500">
            {formatDateTime(date)}
          </time>
        </div>
        {sublabel && (
          <p className="mt-0.5 text-xs text-slate-500">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

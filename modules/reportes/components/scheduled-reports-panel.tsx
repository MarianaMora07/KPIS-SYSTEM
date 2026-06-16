"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePermissions } from "@/components/layout/permissions-context";
import {
  createScheduledReportAction,
  deleteScheduledReportAction,
  toggleScheduledReportAction,
} from "../actions/scheduled-report-actions";
import type { ScheduledReportRow } from "../services/scheduled-reports-service";

export function ScheduledReportsPanel({
  schedules,
}: {
  schedules: ScheduledReportRow[];
}) {
  const { can } = usePermissions();
  const canExport = can("reportes.exportar");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Reportes programados
        </h2>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={!canExport}
          className="text-xs text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Programar reporte
        </button>
      </div>

      {open && canExport && (
        <form
          className="mb-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              await createScheduledReportAction({
                nombre: fd.get("nombre") as string,
                frecuencia_cron: fd.get("frecuencia_cron") as string,
                formato: fd.get("formato") as string,
                emails: fd.get("emails") as string,
              });
              setOpen(false);
            });
          }}
        >
          <input
            name="nombre"
            placeholder="Nombre del reporte"
            defaultValue="Reporte semanal KPIs"
            required
            className="rounded border px-2 py-1 text-sm sm:col-span-2"
          />
          <input
            name="frecuencia_cron"
            placeholder="Cron (ej: 0 8 * * 1)"
            defaultValue="0 8 * * 1"
            required
            className="rounded border px-2 py-1 text-sm font-mono"
          />
          <select name="formato" className="rounded border px-2 py-1 text-sm">
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="pptx">PowerPoint</option>
          </select>
          <input
            name="emails"
            placeholder="Correos (separados por coma)"
            required
            className="rounded border px-2 py-1 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-imperial-900 px-3 py-1 text-sm text-white sm:col-span-2"
          >
            Guardar programación
          </button>
        </form>
      )}

      <ul className="space-y-2 text-sm">
        {schedules.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2"
          >
            <div>
              <p className="font-medium text-imperial-900">{s.nombre}</p>
              <p className="text-xs text-slate-500">
                {s.formato.toUpperCase()} · {s.frecuencia_cron} · {s.emails.join(", ")}
              </p>
              {s.ultima_ejecucion && (
                <p className="text-xs text-slate-400">
                  Última ejecución: {new Date(s.ultima_ejecucion).toLocaleString("es-CO")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {canExport && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => toggleScheduledReportAction(s.id, !s.activo))
                    }
                    className="text-xs text-slate-600"
                  >
                    {s.activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(s.id)}
                    className="text-xs text-red-600"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {schedules.length === 0 && (
          <li className="text-slate-500">No hay reportes programados.</li>
        )}
      </ul>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar programación"
        description="¿Desea eliminar este reporte programado?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={pending}
        onConfirm={() => {
          if (!toDelete) return;
          startTransition(async () => {
            await deleteScheduledReportAction(toDelete);
            setToDelete(null);
          });
        }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

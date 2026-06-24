"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FormModal,
  FormField,
  FormSelect,
  FormActions,
  FormPrimaryButton,
} from "@/components/ui/form-modal";
import { GUIDED_SUCCESS, SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
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
  const { showGuidedSuccess, showSuccess } = useSuccessToast();
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
        {canExport && (
          <FormPrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Programar reporte
          </FormPrimaryButton>
        )}
      </div>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Programar reporte"
        subtitle="Configure la frecuencia y destinatarios del envío automático"
        maxWidth="md"
      >
        <form
          className="space-y-4"
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
              showGuidedSuccess(GUIDED_SUCCESS.scheduledReportCreated);
            });
          }}
        >
          <FormField
            label="Nombre del reporte"
            name="nombre"
            required
            defaultValue="Reporte semanal KPIs"
          />
          <FormField
            label="Expresión cron"
            name="frecuencia_cron"
            required
            defaultValue="0 8 * * 1"
            placeholder="0 8 * * 1"
          />
          <FormSelect
            label="Formato"
            name="formato"
            defaultValue="pdf"
            options={[
              { id: "pdf", nombre: "PDF" },
              { id: "excel", nombre: "Excel" },
              { id: "pptx", nombre: "PowerPoint" },
            ]}
          />
          <FormField
            label="Correos destinatarios"
            name="emails"
            required
            placeholder="correo1@empresa.com, correo2@empresa.com"
          />
          <FormActions
            onCancel={() => setOpen(false)}
            submitLabel="Guardar programación"
            pending={pending}
          />
        </form>
      </FormModal>

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
                      startTransition(async () => {
                        await toggleScheduledReportAction(s.id, !s.activo);
                        showSuccess(SUCCESS_MESSAGES.updated);
                      })
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
            showSuccess(SUCCESS_MESSAGES.deleted);
          });
        }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

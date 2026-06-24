"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { formatFrequencyLabel } from "@/lib/kpis/suggest-frequency";
import { getReviewPeriodDays } from "@/lib/kpis/review-schedule";
import { updateKpiReviewNotificationsAction } from "@/modules/kpis/actions/kpi-actions";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import type { KpiFrequency } from "@/types/database";

interface KpiReviewNotificationsPanelProps {
  kpiId: string;
  kpiCodigo: string;
  frecuencia: KpiFrequency;
  activo: boolean;
  emails: string[];
  ultimoRecordatorioAt: string | null;
  responsableEmail?: string | null;
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export function KpiReviewNotificationsPanel({
  kpiId,
  kpiCodigo,
  frecuencia,
  activo,
  emails,
  ultimoRecordatorioAt,
  responsableEmail,
}: KpiReviewNotificationsPanelProps) {
  const { can } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const router = useRouter();
  const canConfigure = can("metas.configurar");
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(activo);
  const [emailText, setEmailText] = useState(emails.join(", "));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateKpiReviewNotificationsAction(kpiId, {
        recordatorio_email_activo: enabled,
        recordatorio_emails: parseEmails(emailText),
      });
      showSuccess(SUCCESS_MESSAGES.updated);
      router.refresh();
    });
  }

  const periodDays = getReviewPeriodDays(frecuencia);

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-start gap-2">
        <Mail className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden />
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Recordatorios por correo
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Según frecuencia <strong>{formatFrequencyLabel(frecuencia)}</strong> (~{periodDays}{" "}
            días), se envía un aviso si no hay valores recientes. Requiere Activepieces configurado.
          </p>
        </div>
      </div>

      {canConfigure ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            Activar recordatorios de revisión para {kpiCodigo}
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Correos adicionales (opcional)
            </label>
            <input
              type="text"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="analista@estelar.com, director@estelar.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {responsableEmail && (
              <p className="mt-1 text-xs text-slate-500">
                Siempre se incluye al responsable: {responsableEmail}
              </p>
            )}
          </div>
          {ultimoRecordatorioAt && (
            <p className="text-xs text-slate-500">
              Último recordatorio enviado:{" "}
              {new Date(ultimoRecordatorioAt).toLocaleString("es-CO")}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Guardar notificaciones
          </button>
        </form>
      ) : (
        <div className="text-sm text-slate-600">
          <p>
            Recordatorios:{" "}
            <strong>{activo ? "Activos" : "Inactivos"}</strong>
          </p>
          {emails.length > 0 && <p className="mt-1">Correos adicionales: {emails.join(", ")}</p>}
          {ultimoRecordatorioAt && (
            <p className="mt-1 text-xs text-slate-500">
              Último envío: {new Date(ultimoRecordatorioAt).toLocaleString("es-CO")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

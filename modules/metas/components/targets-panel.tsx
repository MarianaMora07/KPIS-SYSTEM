"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { usePermissions } from "@/components/layout/permissions-context";
import { createTargetAction, deleteTargetAction } from "../actions/targets-actions";
import { TargetExpiredBadge } from "./target-expired-badge";

interface TargetsPanelProps {
  kpiId: string;
  targets: Record<string, unknown>[];
  regions?: { id: string; nombre: string }[];
  hotels?: { id: string; nombre: string }[];
  campaigns?: { id: string; nombre: string }[];
}

const PERIODOS = [
  { id: "mensual", nombre: "Mensual" },
  { id: "trimestral", nombre: "Trimestral" },
  { id: "semestral", nombre: "Semestral" },
  { id: "anual", nombre: "Anual" },
  { id: "especial", nombre: "Especial" },
] as const;

export function TargetsPanel({
  kpiId,
  targets,
  regions = [],
  hotels = [],
  campaigns = [],
}: TargetsPanelProps) {
  const { can } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const canConfigure = can("metas.configurar");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  function handleConfirmDelete() {
    if (!toDelete) return;
    startTransition(async () => {
      await deleteTargetAction(kpiId, toDelete);
      setToDelete(null);
      showSuccess(SUCCESS_MESSAGES.deleted);
    });
  }

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Metas por periodo
        </h2>
        {canConfigure && (
          <button type="button" onClick={() => setOpen(!open)} className="text-xs text-amber-700">
            + Nueva meta
          </button>
        )}
      </div>

      {open && canConfigure && (
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
                region_id: (fd.get("region_id") as string) || null,
                hotel_id: (fd.get("hotel_id") as string) || null,
                marketing_campaign_id: (fd.get("marketing_campaign_id") as string) || null,
              });
              setOpen(false);
            });
          }}
        >
          <select name="periodo_tipo" className="rounded border px-2 py-1 text-sm sm:col-span-2">
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input name="valor_meta" type="number" step="any" placeholder="Meta" required className="rounded border px-2 py-1 text-sm" />
          <input name="fecha_inicio" type="date" required className="rounded border px-2 py-1 text-sm" />
          <input name="fecha_fin" type="date" required className="rounded border px-2 py-1 text-sm" />
          {regions.length > 0 && (
            <select name="region_id" className="rounded border px-2 py-1 text-sm">
              <option value="">Todas las regiones</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          )}
          {hotels.length > 0 && (
            <select name="hotel_id" className="rounded border px-2 py-1 text-sm">
              <option value="">Todos los hoteles</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </select>
          )}
          {campaigns.length > 0 && (
            <select name="marketing_campaign_id" className="rounded border px-2 py-1 text-sm">
              <option value="">Todas las campañas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={pending} className="rounded bg-imperial-900 px-3 py-1 text-sm text-white sm:col-span-2">
            Guardar meta
          </button>
        </form>
      )}

      <ul className="space-y-2 text-sm">
        {targets.map((t) => (
          <li key={t.id as string} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2">
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {t.periodo_tipo as string}: {t.fecha_inicio as string} — {t.fecha_fin as string} ·{" "}
                {t.valor_meta as number}
              </span>
              <TargetExpiredBadge fechaFin={t.fecha_fin as string} />
            </span>
            {canConfigure && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setToDelete(t.id as string)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Eliminar
              </button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar meta"
        description="¿Desea eliminar esta meta?"
        confirmLabel="Eliminar"
        variant="danger"
        loading={pending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

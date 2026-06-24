"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FormModal,
  FormField,
  FormSelect,
  FormActions,
  FormPrimaryButton,
} from "@/components/ui/form-modal";
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

const emptyScopeOption = { id: "", nombre: "Global / todas" };

function targetScopeLabel(
  target: Record<string, unknown>,
  regions: { id: string; nombre: string }[],
  hotels: { id: string; nombre: string }[],
  campaigns: { id: string; nombre: string }[]
): string {
  const hotelId = target.hotel_id as string | null | undefined;
  const regionId = target.region_id as string | null | undefined;
  const campaignId = target.marketing_campaign_id as string | null | undefined;

  if (hotelId) return hotels.find((h) => h.id === hotelId)?.nombre ?? "Hotel";
  if (regionId) return regions.find((r) => r.id === regionId)?.nombre ?? "Región";
  if (campaignId) return campaigns.find((c) => c.id === campaignId)?.nombre ?? "Campaña";
  return "Global";
}

export function TargetsPanel({
  kpiId,
  targets,
  regions = [],
  hotels = [],
  campaigns = [],
}: TargetsPanelProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const canConfigure = can("metas.configurar");
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  function handleCloseCreate() {
    setCreateOpen(false);
  }

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const valorAvanceRaw = fd.get("valor_avance");
      const valorAvance =
        valorAvanceRaw != null && String(valorAvanceRaw).trim() !== ""
          ? Number(valorAvanceRaw)
          : undefined;

      await createTargetAction(kpiId, {
        kpi_id: kpiId,
        periodo_tipo: fd.get("periodo_tipo") as "mensual",
        fecha_inicio: fd.get("fecha_inicio") as string,
        fecha_fin: fd.get("fecha_fin") as string,
        valor_meta: Number(fd.get("valor_meta")),
        region_id: (fd.get("region_id") as string) || null,
        hotel_id: (fd.get("hotel_id") as string) || null,
        marketing_campaign_id: (fd.get("marketing_campaign_id") as string) || null,
        valor_avance: valorAvance,
      });
      handleCloseCreate();
      showSuccess(SUCCESS_MESSAGES.created);
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!toDelete) return;
    startTransition(async () => {
      await deleteTargetAction(kpiId, toDelete);
      setToDelete(null);
      showSuccess(SUCCESS_MESSAGES.deleted);
      router.refresh();
    });
  }

  return (
    <>
      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Metas por periodo
          </h2>
          {canConfigure && (
            <FormPrimaryButton onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva meta
            </FormPrimaryButton>
          )}
        </div>

        <ul className="space-y-2 text-sm">
          {targets.map((t) => (
            <li
              key={t.id as string}
              className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {targetScopeLabel(t, regions, hotels, campaigns)}
                </span>
                <span>
                  {t.periodo_tipo as string}: {t.fecha_inicio as string} — {t.fecha_fin as string} ·{" "}
                  meta {t.valor_meta as number}
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
          {targets.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-slate-500">
              No hay metas configuradas. Defina objetivos globales o por hotel/región para este
              indicador.
            </li>
          )}
        </ul>
      </section>

      <FormModal
        open={createOpen}
        onClose={handleCloseCreate}
        title="Nueva meta por periodo"
        subtitle="Defina el objetivo, las fechas y el alcance organizacional"
        maxWidth="md"
      >
        <form className="space-y-4" onSubmit={handleCreateSubmit}>
          <FormSelect
            label="Periodo *"
            name="periodo_tipo"
            required
            options={PERIODOS.map((p) => ({ id: p.id, nombre: p.nombre }))}
            defaultValue="mensual"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Meta *"
              name="valor_meta"
              type="number"
              step="any"
              required
              placeholder="Ej. 60000"
            />
            <FormField
              label="Avance inicial (opcional)"
              name="valor_avance"
              type="number"
              step="any"
              placeholder="Primer valor registrado"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Fecha inicio *" name="fecha_inicio" type="date" required />
            <FormField label="Fecha fin *" name="fecha_fin" type="date" required />
          </div>
          {regions.length > 0 && (
            <FormSelect
              label="Región"
              name="region_id"
              options={[emptyScopeOption, ...regions]}
            />
          )}
          {hotels.length > 0 && (
            <FormSelect
              label="Hotel"
              name="hotel_id"
              options={[emptyScopeOption, ...hotels]}
            />
          )}
          {campaigns.length > 0 && (
            <FormSelect
              label="Campaña"
              name="marketing_campaign_id"
              options={[emptyScopeOption, ...campaigns]}
            />
          )}
          <p className="text-xs text-slate-500">
            Deje región, hotel y campaña vacíos para una meta global. El avance inicial alimenta el
            cumplimiento en el dashboard; si no lo indica, regístrelo en Seguimiento.
          </p>
          <FormActions
            onCancel={handleCloseCreate}
            submitLabel="Guardar meta"
            pending={pending}
            pendingLabel="Guardando..."
          />
        </form>
      </FormModal>

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
    </>
  );
}

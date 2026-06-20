"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateKpiAction } from "@/modules/kpis/actions/kpi-actions";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import { KpiFormFields, type KpiFormCatalogs } from "./kpi-form-fields";
import { usePermissions } from "@/components/layout/permissions-context";
import { FormModal, FormSecondaryButton } from "@/components/ui/form-modal";

interface KpiEditFormProps {
  kpiId: string;
  defaultValues: KpiCreateInput;
  catalogs: KpiFormCatalogs;
  /** page = ruta /editar; modal = botón en detalle */
  variant?: "page" | "modal";
}

export function KpiEditForm({
  kpiId,
  defaultValues,
  catalogs,
  variant = "page",
}: KpiEditFormProps) {
  const { can } = usePermissions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!can("kpis.editar")) return null;

  function handleSubmit(input: KpiCreateInput) {
    setError(null);
    startTransition(async () => {
      try {
        await updateKpiAction(kpiId, input);
        if (variant === "modal") setOpen(false);
        else router.push(`/kpis/${kpiId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar KPI");
      }
    });
  }

  const form = (
    <KpiFormFields
      catalogs={catalogs}
      defaultValues={defaultValues}
      error={error}
      pending={pending}
      showEstado
      onCancel={() =>
        variant === "modal" ? setOpen(false) : router.push(`/kpis/${kpiId}`)
      }
      submitLabel="Guardar cambios"
      onSubmit={handleSubmit}
    />
  );

  if (variant === "modal") {
    return (
      <>
        <FormSecondaryButton onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Editar
        </FormSecondaryButton>
        <FormModal
          open={open}
          onClose={() => setOpen(false)}
          title="Editar KPI"
          subtitle={`${defaultValues.codigo} — ${defaultValues.nombre}`}
          maxWidth="lg"
        >
          {form}
        </FormModal>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="glass rounded-xl border border-slate-200/60 p-6">
        <h1 className="mb-6 text-xl font-semibold text-imperial-900">Editar KPI</h1>
        {form}
      </div>
    </div>
  );
}

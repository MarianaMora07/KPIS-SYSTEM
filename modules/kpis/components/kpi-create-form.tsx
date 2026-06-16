"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createKpiAction } from "@/modules/kpis/actions/kpi-actions";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import {
  FormModal,
  FormPrimaryButton,
} from "@/components/ui/form-modal";
import { KpiFormFields, type KpiFormCatalogs } from "./kpi-form-fields";
import { usePermissions } from "@/components/layout/permissions-context";
import { formatZodError } from "@/lib/validations/format-zod-error";

interface KpiCreateFormProps extends KpiFormCatalogs {}

export function KpiCreateForm(catalogs: KpiCreateFormProps) {
  const { can } = usePermissions();
  const canCreate = can("kpis.crear");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(input: KpiCreateInput) {
    setError(null);
    startTransition(async () => {
      try {
        await createKpiAction(input);
        setOpen(false);
      } catch (err) {
        setError(formatZodError(err));
      }
    });
  }

  if (!canCreate) {
    return null;
  }

  return (
    <>
      <FormPrimaryButton onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Crear KPI
      </FormPrimaryButton>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Crear KPI"
        subtitle="Complete los campos obligatorios del indicador comercial"
      >
        <KpiFormFields
          catalogs={catalogs}
          error={error}
          pending={pending}
          onCancel={() => setOpen(false)}
          submitLabel="Guardar KPI"
          onSubmit={handleSubmit}
        />
      </FormModal>
    </>
  );
}

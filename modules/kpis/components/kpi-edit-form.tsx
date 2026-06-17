"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateKpiAction } from "@/modules/kpis/actions/kpi-actions";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import { KpiFormFields, type KpiFormCatalogs } from "./kpi-form-fields";
import { usePermissions } from "@/components/layout/permissions-context";

interface KpiEditFormProps {
  kpiId: string;
  defaultValues: KpiCreateInput;
  catalogs: KpiFormCatalogs;
}

export function KpiEditForm({ kpiId, defaultValues, catalogs }: KpiEditFormProps) {
  const { can } = usePermissions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!can("kpis.editar")) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-800">
        No tiene permiso para editar KPIs.
      </div>
    );
  }

  function handleSubmit(input: KpiCreateInput) {
    setError(null);
    startTransition(async () => {
      try {
        await updateKpiAction(kpiId, input);
        router.push(`/kpis/${kpiId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar KPI");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="glass rounded-xl border border-slate-200/60 p-6">
      <h1 className="mb-6 text-xl font-semibold text-imperial-900">Editar KPI</h1>
      <KpiFormFields
        catalogs={catalogs}
        defaultValues={defaultValues}
        error={error}
        pending={pending}
        showEstado
        onCancel={() => router.push(`/kpis/${kpiId}`)}
        submitLabel="Guardar cambios"
        onSubmit={handleSubmit}
      />
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerKpiValueAction } from "@/modules/kpis/actions/kpi-actions";
import { usePermissions } from "@/components/layout/permissions-context";
import {
  FormModal,
  FormSelect,
  FormField,
  FormActions,
  FormError,
  FormSecondaryButton,
} from "@/components/ui/form-modal";

interface RegisterValueFormProps {
  kpis: { id: string; codigo: string; nombre: string }[];
  defaultKpiId?: string;
}

export function RegisterValueForm({
  kpis,
  defaultKpiId,
}: RegisterValueFormProps) {
  const { can } = usePermissions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!can("metas.configurar") || kpis.length === 0) return null;

  const singleKpi = kpis.length === 1;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const kpiId = (fd.get("kpi_id") as string) || defaultKpiId || kpis[0].id;
    const fecha = fd.get("fecha") as string;

    startTransition(async () => {
      try {
        await registerKpiValueAction({
          kpi_id: kpiId,
          fecha,
          valor_real: Number(fd.get("valor_real")),
          valor_meta: fd.get("valor_meta")
            ? Number(fd.get("valor_meta"))
            : null,
        });
        setOpen(false);
        (e.target as HTMLFormElement).reset();
        router.push(`/kpis/${kpiId}?valor=${fecha}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al registrar valor");
      }
    });
  }

  return (
    <>
      <FormSecondaryButton onClick={() => setOpen(true)}>
        Registrar valor
      </FormSecondaryButton>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar valor de KPI"
        subtitle="El cumplimiento y semáforo se calculan automáticamente"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {singleKpi ? (
            <input type="hidden" name="kpi_id" value={defaultKpiId ?? kpis[0].id} />
          ) : (
            <FormSelect
              label="KPI *"
              name="kpi_id"
              required
              defaultValue={defaultKpiId}
              options={kpis.map((k) => ({
                id: k.id,
                nombre: `${k.codigo} — ${k.nombre}`,
              }))}
            />
          )}
          {singleKpi && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {kpis[0].codigo} — {kpis[0].nombre}
            </p>
          )}
          <FormField
            label="Fecha *"
            name="fecha"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <FormField
            label="Valor real *"
            name="valor_real"
            type="number"
            step="any"
            required
          />
          <FormField label="Meta (opcional)" name="valor_meta" type="number" step="any" />
          {error && <FormError message={error} />}
          <FormActions
            onCancel={() => setOpen(false)}
            submitLabel="Registrar valor"
            pending={pending}
          />
        </form>
      </FormModal>
    </>
  );
}

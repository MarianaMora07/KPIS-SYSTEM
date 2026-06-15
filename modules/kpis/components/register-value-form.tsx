"use client";

import { useState, useTransition } from "react";
import { registerKpiValueAction } from "@/modules/kpis/actions/kpi-actions";
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
}

export function RegisterValueForm({ kpis }: RegisterValueFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (kpis.length === 0) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await registerKpiValueAction({
          kpi_id: fd.get("kpi_id") as string,
          fecha: fd.get("fecha") as string,
          valor_real: Number(fd.get("valor_real")),
          valor_meta: fd.get("valor_meta")
            ? Number(fd.get("valor_meta"))
            : null,
        });
        setOpen(false);
        (e.target as HTMLFormElement).reset();
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
          <FormSelect
            label="KPI *"
            name="kpi_id"
            required
            options={kpis.map((k) => ({
              id: k.id,
              nombre: `${k.codigo} — ${k.nombre}`,
            }))}
          />
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

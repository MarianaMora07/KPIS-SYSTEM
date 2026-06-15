"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createKpiAction } from "@/modules/kpis/actions/kpi-actions";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import {
  FormModal,
  FormField,
  FormSelect,
  FormActions,
  FormError,
  FormPrimaryButton,
} from "@/components/ui/form-modal";

interface KpiCreateFormProps {
  categories: { id: string; nombre: string }[];
  regions: { id: string; nombre: string }[];
  hotels: { id: string; nombre: string; region_id: string }[];
}

const FRECUENCIAS = [
  "diaria",
  "semanal",
  "mensual",
  "trimestral",
  "semestral",
  "anual",
] as const;

const TIPOS = ["estrategico", "tactico", "operativo"] as const;

export function KpiCreateForm({
  categories,
  regions,
  hotels,
}: KpiCreateFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const input: KpiCreateInput = {
      nombre: fd.get("nombre") as string,
      codigo: fd.get("codigo") as string,
      categoria_id: fd.get("categoria_id") as string,
      area_responsable: fd.get("area_responsable") as string,
      frecuencia: fd.get("frecuencia") as KpiCreateInput["frecuencia"],
      unidad_medida: fd.get("unidad_medida") as string,
      fuente_informacion: fd.get("fuente_informacion") as string,
      tipo_indicador: fd.get("tipo_indicador") as KpiCreateInput["tipo_indicador"],
      meta: fd.get("meta") ? Number(fd.get("meta")) : null,
      formula: (fd.get("formula") as string) || null,
      region_id: (fd.get("region_id") as string) || null,
      hotel_id: (fd.get("hotel_id") as string) || null,
    };

    startTransition(async () => {
      try {
        await createKpiAction(input);
        setOpen(false);
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear KPI");
      }
    });
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nombre *" name="nombre" required />
          <FormField label="Código *" name="codigo" required placeholder="OCP-002" />
          <FormSelect label="Categoría *" name="categoria_id" required options={categories} />
          <FormField label="Área responsable *" name="area_responsable" required />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect
              label="Frecuencia *"
              name="frecuencia"
              required
              options={FRECUENCIAS.map((f) => ({ id: f, nombre: f }))}
            />
            <FormSelect
              label="Tipo *"
              name="tipo_indicador"
              required
              options={TIPOS.map((t) => ({ id: t, nombre: t }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unidad medida *" name="unidad_medida" required placeholder="%" />
            <FormField label="Meta" name="meta" type="number" step="any" />
          </div>
          <FormField label="Fuente información *" name="fuente_informacion" required />
          <FormField label="Fórmula" name="formula" />
          <FormSelect
            label="Región"
            name="region_id"
            options={[{ id: "", nombre: "— Ninguna —" }, ...regions]}
          />
          <FormSelect
            label="Hotel"
            name="hotel_id"
            options={[{ id: "", nombre: "— Ninguno —" }, ...hotels]}
          />
          {error && <FormError message={error} />}
          <FormActions
            onCancel={() => setOpen(false)}
            submitLabel="Guardar KPI"
            pending={pending}
          />
        </form>
      </FormModal>
    </>
  );
}

"use client";

import {
  FormField,
  FormSelect,
  FormError,
  FormActions,
} from "@/components/ui/form-modal";
import { FormUnitSelect } from "@/components/ui/form-unit-select";
import type { KpiCreateInput } from "@/lib/validations/schemas";

const FRECUENCIAS = [
  "diaria",
  "semanal",
  "mensual",
  "trimestral",
  "semestral",
  "anual",
] as const;

const TIPOS = ["estrategico", "tactico", "operativo"] as const;

export interface KpiFormCatalogs {
  categories: { id: string; nombre: string }[];
  regions: { id: string; nombre: string }[];
  hotels: { id: string; nombre: string; region_id?: string }[];
  users?: { id: string; nombre: string }[];
  businessUnits?: { id: string; nombre: string }[];
  salesChannels?: { id: string; nombre: string }[];
  campaigns?: { id: string; nombre: string }[];
  teams?: { id: string; nombre: string }[];
}

interface KpiFormFieldsProps {
  catalogs: KpiFormCatalogs;
  defaultValues?: Partial<KpiCreateInput>;
  error?: string | null;
  pending?: boolean;
  showEstado?: boolean;
  hideFormula?: boolean;
  hideCodigo?: boolean;
  onCancel: () => void;
  submitLabel: string;
  onSubmit: (input: KpiCreateInput) => void;
}

const emptyOption = { id: "", nombre: "— Ninguno —" };

export function KpiFormFields({
  catalogs,
  defaultValues,
  error,
  pending,
  showEstado = false,
  hideFormula = false,
  hideCodigo = false,
  onCancel,
  submitLabel,
  onSubmit,
}: KpiFormFieldsProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: KpiCreateInput = {
      nombre: fd.get("nombre") as string,
      codigo: hideCodigo ? "" : (fd.get("codigo") as string),
      categoria_id: fd.get("categoria_id") as string,
      area_responsable: fd.get("area_responsable") as string,
      responsable_id: (fd.get("responsable_id") as string) || null,
      frecuencia: fd.get("frecuencia") as KpiCreateInput["frecuencia"],
      unidad_medida: fd.get("unidad_medida") as string,
      fuente_informacion: fd.get("fuente_informacion") as string,
      tipo_indicador: fd.get("tipo_indicador") as KpiCreateInput["tipo_indicador"],
      meta: fd.get("meta") ? Number(fd.get("meta")) : null,
      formula: hideFormula ? null : (fd.get("formula") as string) || null,
      estado: showEstado
        ? (fd.get("estado") as "activo" | "inactivo")
        : undefined,
      region_id: (fd.get("region_id") as string) || null,
      hotel_id: (fd.get("hotel_id") as string) || null,
      business_unit_id: (fd.get("business_unit_id") as string) || null,
      sales_channel_id: (fd.get("sales_channel_id") as string) || null,
      marketing_campaign_id: (fd.get("marketing_campaign_id") as string) || null,
      commercial_team_id: (fd.get("commercial_team_id") as string) || null,
    };
    onSubmit(input);
  }

  const dv = defaultValues ?? {};

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Nombre *" name="nombre" required defaultValue={dv.nombre} />
      {!hideCodigo && (
        <FormField label="Código *" name="codigo" required defaultValue={dv.codigo} placeholder="OCP-002" />
      )}
      {hideCodigo && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          El código del indicador se asignará automáticamente al crearlo (formato KPI-001, KPI-002…).
        </p>
      )}
      <FormSelect
        label="Categoría *"
        name="categoria_id"
        required
        options={catalogs.categories}
        defaultValue={dv.categoria_id}
      />
      <FormField label="Área responsable *" name="area_responsable" required defaultValue={dv.area_responsable} />
      {catalogs.users && catalogs.users.length > 0 && (
        <FormSelect
          label="Responsable"
          name="responsable_id"
          options={[emptyOption, ...catalogs.users]}
          defaultValue={dv.responsable_id ?? ""}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormSelect
          label="Frecuencia *"
          name="frecuencia"
          required
          options={FRECUENCIAS.map((f) => ({ id: f, nombre: f }))}
          defaultValue={dv.frecuencia}
        />
        <FormSelect
          label="Tipo *"
          name="tipo_indicador"
          required
          options={TIPOS.map((t) => ({ id: t, nombre: t }))}
          defaultValue={dv.tipo_indicador}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormUnitSelect
          label="Unidad medida *"
          name="unidad_medida"
          required
          defaultValue={dv.unidad_medida}
        />
        <FormField label="Meta" name="meta" type="number" step="any" defaultValue={dv.meta != null ? String(dv.meta) : undefined} />
      </div>
      <FormField label="Fuente información *" name="fuente_informacion" required defaultValue={dv.fuente_informacion} />
      {!hideFormula && (
        <FormField label="Fórmula" name="formula" defaultValue={dv.formula ?? undefined} />
      )}
      <FormSelect
        label="Región"
        name="region_id"
        options={[emptyOption, ...catalogs.regions]}
        defaultValue={dv.region_id ?? ""}
      />
      <FormSelect
        label="Hotel"
        name="hotel_id"
        options={[emptyOption, ...catalogs.hotels]}
        defaultValue={dv.hotel_id ?? ""}
      />
      {catalogs.businessUnits && (
        <FormSelect
          label="Unidad de negocio"
          name="business_unit_id"
          options={[emptyOption, ...catalogs.businessUnits]}
          defaultValue={dv.business_unit_id ?? ""}
        />
      )}
      {catalogs.salesChannels && (
        <FormSelect
          label="Canal de venta"
          name="sales_channel_id"
          options={[emptyOption, ...catalogs.salesChannels]}
          defaultValue={dv.sales_channel_id ?? ""}
        />
      )}
      {catalogs.campaigns && (
        <FormSelect
          label="Campaña"
          name="marketing_campaign_id"
          options={[emptyOption, ...catalogs.campaigns]}
          defaultValue={dv.marketing_campaign_id ?? ""}
        />
      )}
      {catalogs.teams && (
        <FormSelect
          label="Equipo comercial"
          name="commercial_team_id"
          options={[emptyOption, ...catalogs.teams]}
          defaultValue={dv.commercial_team_id ?? ""}
        />
      )}
      {showEstado && (
        <FormSelect
          label="Estado"
          name="estado"
          options={[
            { id: "activo", nombre: "Activo" },
            { id: "inactivo", nombre: "Inactivo" },
          ]}
          defaultValue={dv.estado ?? "activo"}
        />
      )}
      {error && <FormError message={error} />}
      <FormActions onCancel={onCancel} submitLabel={submitLabel} pending={pending} />
    </form>
  );
}

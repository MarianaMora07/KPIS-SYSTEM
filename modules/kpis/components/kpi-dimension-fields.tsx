"use client";

import { FormSelect } from "@/components/ui/form-modal";
import type { DimensionCatalogs, KpiDimensionScope } from "@/lib/kpis/dimension-scope";

interface KpiDimensionFieldsProps {
  kpiDefaults: Partial<KpiDimensionScope>;
  catalogs: DimensionCatalogs;
}

const FIELD_CONFIG: {
  key: keyof KpiDimensionScope;
  label: string;
  catalogKey: keyof DimensionCatalogs;
  name: string;
}[] = [
  { key: "hotel_id", label: "Hotel", catalogKey: "hotels", name: "hotel_id" },
  { key: "region_id", label: "Región", catalogKey: "regions", name: "region_id" },
  {
    key: "business_unit_id",
    label: "Unidad de negocio",
    catalogKey: "businessUnits",
    name: "business_unit_id",
  },
  {
    key: "sales_channel_id",
    label: "Canal de venta",
    catalogKey: "salesChannels",
    name: "sales_channel_id",
  },
  {
    key: "marketing_campaign_id",
    label: "Campaña",
    catalogKey: "campaigns",
    name: "marketing_campaign_id",
  },
  {
    key: "commercial_team_id",
    label: "Equipo comercial",
    catalogKey: "teams",
    name: "commercial_team_id",
  },
];

export function KpiDimensionFields({ kpiDefaults, catalogs }: KpiDimensionFieldsProps) {
  const visibleFields = FIELD_CONFIG.filter(({ key, catalogKey }) => {
    if (kpiDefaults[key]) return true;
    const options = catalogs[catalogKey];
    return options != null && options.length > 0;
  });

  if (visibleFields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Desglose</p>
      {visibleFields.map(({ key, label, catalogKey, name }) => {
        const locked = kpiDefaults[key];
        if (locked) {
          const options = catalogs[catalogKey] ?? [];
          const labelName = options.find((o) => o.id === locked)?.nombre ?? locked;
          return (
            <div key={key}>
              <input type="hidden" name={name} value={locked} />
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm text-slate-700">{labelName}</p>
            </div>
          );
        }

        const options = catalogs[catalogKey];
        if (!options?.length) return null;

        return (
          <FormSelect
            key={key}
            label={`${label} (opcional)`}
            name={name}
            options={[{ id: "", nombre: "Sin especificar" }, ...options]}
          />
        );
      })}
    </div>
  );
}

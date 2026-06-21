/** Dimensiones organizacionales del desglose operativo (no afectan la fórmula del KPI). */

export type KpiDimensionScope = {
  hotel_id: string | null;
  region_id: string | null;
  business_unit_id: string | null;
  sales_channel_id: string | null;
  marketing_campaign_id: string | null;
  commercial_team_id: string | null;
};

export type DimensionCatalogItem = { id: string; nombre: string };

export type DimensionCatalogs = {
  regions?: DimensionCatalogItem[];
  hotels?: DimensionCatalogItem[];
  businessUnits?: DimensionCatalogItem[];
  salesChannels?: DimensionCatalogItem[];
  campaigns?: DimensionCatalogItem[];
  teams?: DimensionCatalogItem[];
};

export const KPI_DIMENSION_FIELDS: (keyof KpiDimensionScope)[] = [
  "hotel_id",
  "region_id",
  "business_unit_id",
  "sales_channel_id",
  "marketing_campaign_id",
  "commercial_team_id",
];

export function emptyDimensionScope(): KpiDimensionScope {
  return {
    hotel_id: null,
    region_id: null,
    business_unit_id: null,
    sales_channel_id: null,
    marketing_campaign_id: null,
    commercial_team_id: null,
  };
}

export function resolveValueDimensions(
  input: Partial<KpiDimensionScope>,
  kpiDefaults: Partial<KpiDimensionScope>
): KpiDimensionScope {
  return {
    hotel_id: input.hotel_id ?? kpiDefaults.hotel_id ?? null,
    region_id: input.region_id ?? kpiDefaults.region_id ?? null,
    business_unit_id: input.business_unit_id ?? kpiDefaults.business_unit_id ?? null,
    sales_channel_id: input.sales_channel_id ?? kpiDefaults.sales_channel_id ?? null,
    marketing_campaign_id:
      input.marketing_campaign_id ?? kpiDefaults.marketing_campaign_id ?? null,
    commercial_team_id: input.commercial_team_id ?? kpiDefaults.commercial_team_id ?? null,
  };
}

type TargetScope = {
  hotel_id?: string | null;
  region_id?: string | null;
  marketing_campaign_id?: string | null;
};

/** Compara meta vs valor por dimensión (más específico primero). */
export function matchesTargetScope(
  target: TargetScope,
  value: Pick<KpiDimensionScope, "hotel_id" | "region_id" | "marketing_campaign_id">
): boolean {
  if (target.hotel_id) return value.hotel_id === target.hotel_id;
  if (target.region_id) return value.region_id === target.region_id;
  if (target.marketing_campaign_id) {
    return value.marketing_campaign_id === target.marketing_campaign_id;
  }
  return true;
}

function lookupName(
  id: string | null | undefined,
  items?: DimensionCatalogItem[]
): string | null {
  if (!id || !items?.length) return null;
  return items.find((x) => x.id === id)?.nombre ?? null;
}

/** Etiqueta legible del desglose de un valor (null si no hay dimensiones). */
export function formatDimensionScopeLabel(
  scope: Partial<KpiDimensionScope>,
  catalogs: DimensionCatalogs = {}
): string | null {
  const parts: string[] = [];
  const hotel = lookupName(scope.hotel_id, catalogs.hotels);
  const region = lookupName(scope.region_id, catalogs.regions);
  const bu = lookupName(scope.business_unit_id, catalogs.businessUnits);
  const channel = lookupName(scope.sales_channel_id, catalogs.salesChannels);
  const campaign = lookupName(scope.marketing_campaign_id, catalogs.campaigns);
  const team = lookupName(scope.commercial_team_id, catalogs.teams);

  if (hotel) parts.push(`Hotel: ${hotel}`);
  if (region) parts.push(`Región: ${region}`);
  if (bu) parts.push(`Unidad: ${bu}`);
  if (channel) parts.push(`Canal: ${channel}`);
  if (campaign) parts.push(`Campaña: ${campaign}`);
  if (team) parts.push(`Equipo: ${team}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function hasAnyDimension(scope: Partial<KpiDimensionScope>): boolean {
  return KPI_DIMENSION_FIELDS.some((key) => scope[key] != null);
}

import { matchesTargetScope } from "@/lib/kpis/dimension-scope";
import type { DimensionCatalogs } from "@/lib/kpis/dimension-scope";

export interface TargetRowForMatch {
  id: string;
  periodo_tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  valor_meta: number;
  hotel_id: string | null;
  region_id: string | null;
  marketing_campaign_id?: string | null;
}

export interface ValueScopeForMatch {
  fecha: string;
  hotel_id: string | null;
  region_id: string | null;
  marketing_campaign_id: string | null;
}

export function targetMatchesValue(
  target: TargetRowForMatch,
  value: ValueScopeForMatch
): boolean {
  if (value.fecha < target.fecha_inicio || value.fecha > target.fecha_fin) {
    return false;
  }
  return matchesTargetScope(target, value);
}

export function splitTargetsByValueMatch(
  targets: TargetRowForMatch[],
  value: ValueScopeForMatch
): { matches: TargetRowForMatch[]; nonMatches: TargetRowForMatch[] } {
  const matches: TargetRowForMatch[] = [];
  const nonMatches: TargetRowForMatch[] = [];

  for (const target of targets) {
    if (targetMatchesValue(target, value)) {
      matches.push(target);
    } else {
      nonMatches.push(target);
    }
  }

  return { matches, nonMatches };
}

export function formatTargetScopeLabel(
  target: Pick<TargetRowForMatch, "hotel_id" | "region_id" | "marketing_campaign_id">,
  catalogs: DimensionCatalogs = {}
): string {
  const hotelId = target.hotel_id;
  const regionId = target.region_id;
  const campaignId = target.marketing_campaign_id;

  if (hotelId) {
    return catalogs.hotels?.find((h) => h.id === hotelId)?.nombre ?? "Hotel";
  }
  if (regionId) {
    return catalogs.regions?.find((r) => r.id === regionId)?.nombre ?? "Región";
  }
  if (campaignId) {
    return catalogs.campaigns?.find((c) => c.id === campaignId)?.nombre ?? "Campaña";
  }
  return "Global";
}

const PERIODO_LABELS: Record<string, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  especial: "Especial",
};

export function formatTargetPeriodLabel(periodoTipo: string): string {
  return PERIODO_LABELS[periodoTipo] ?? periodoTipo;
}

import {
  targetMatchesValue,
  type TargetRowForMatch,
  type ValueScopeForMatch,
} from "@/lib/metas/match-value-to-targets";
import {
  computeSemaforoFromCumplimiento,
  type TrafficLightRangeInput,
} from "@/lib/kpis/compute-semaforo";
import type { TrafficLightStatus } from "@/types/database";

const PERIOD_PRIORITY: Record<string, number> = {
  especial: 5,
  mensual: 4,
  trimestral: 3,
  semestral: 2,
  anual: 1,
};

function scopePriority(target: TargetRowForMatch): number {
  if (target.hotel_id) return 4;
  if (target.region_id) return 3;
  if (target.marketing_campaign_id) return 2;
  return 1;
}

export function mapRawTargetsForMatch(
  raw: Record<string, unknown>[]
): TargetRowForMatch[] {
  return raw.map((t) => ({
    id: t.id as string,
    periodo_tipo: t.periodo_tipo as string,
    fecha_inicio: t.fecha_inicio as string,
    fecha_fin: t.fecha_fin as string,
    valor_meta: Number(t.valor_meta),
    hotel_id: (t.hotel_id as string | null) ?? null,
    region_id: (t.region_id as string | null) ?? null,
    marketing_campaign_id: (t.marketing_campaign_id as string | null) ?? null,
  }));
}

export function pickPrimaryMatchingTarget(
  targets: TargetRowForMatch[],
  value: ValueScopeForMatch
): TargetRowForMatch | null {
  const matches = targets.filter((t) => targetMatchesValue(t, value));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  return [...matches].sort((a, b) => {
    const scopeDiff = scopePriority(b) - scopePriority(a);
    if (scopeDiff !== 0) return scopeDiff;
    return (
      (PERIOD_PRIORITY[b.periodo_tipo] ?? 0) -
      (PERIOD_PRIORITY[a.periodo_tipo] ?? 0)
    );
  })[0]!;
}

export function computeCumplimientoPct(
  valorReal: number,
  valorMeta: number | null | undefined
): number | null {
  if (valorMeta == null || valorMeta === 0) return null;
  return Math.round((valorReal / valorMeta) * 10000) / 100;
}

export interface ValueComplianceFields {
  valor_meta: number | null;
  cumplimiento_pct: number | null;
  semaforo_calculado: TrafficLightStatus | null;
  matched_target_id: string | null;
}

export function resolveValueCompliance(
  value: ValueScopeForMatch & { valor_real: number },
  targets: TargetRowForMatch[],
  trafficLightRanges?: TrafficLightRangeInput | null
): ValueComplianceFields {
  const target = pickPrimaryMatchingTarget(targets, value);
  const valor_meta = target ? Number(target.valor_meta) : null;
  const cumplimiento_pct = computeCumplimientoPct(value.valor_real, valor_meta);
  const semaforo_calculado = computeSemaforoFromCumplimiento(
    cumplimiento_pct,
    trafficLightRanges ?? undefined
  );

  return {
    valor_meta,
    cumplimiento_pct,
    semaforo_calculado,
    matched_target_id: target?.id ?? null,
  };
}

export function enrichKpiValueWithTargets<T extends ValueScopeForMatch & { valor_real: number }>(
  value: T,
  targets: TargetRowForMatch[],
  trafficLightRanges?: TrafficLightRangeInput | null
): T & ValueComplianceFields {
  return { ...value, ...resolveValueCompliance(value, targets, trafficLightRanges) };
}

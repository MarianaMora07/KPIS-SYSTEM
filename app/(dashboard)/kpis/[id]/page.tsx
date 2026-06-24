import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getKpiById,
  listKpiVersions,
  listKpiValues,
} from "@/modules/kpis/services/kpi-service";
import { KpiDetailView, type KpiDetailTab } from "@/modules/kpis/components/kpi-detail-view";
import { listTargets, listTrafficLightRanges } from "@/modules/metas/services/targets-service";
import {
  listVariables,
  getKpiFormula,
} from "@/modules/formulas/services/formula-service";
import { getRequiredInputVariableCodes } from "@/lib/kpis/compute-formula-value";
import { formatDimensionScopeLabel } from "@/lib/kpis/dimension-scope";
import {
  enrichKpiValueWithTargets,
  mapRawTargetsForMatch,
} from "@/lib/metas/resolve-value-compliance";
import { listRegions, listHotels, listKpiCategories, listBusinessUnits, listSalesChannels, listMarketingCampaigns, listCommercialTeams } from "@/modules/catalog";
import { listUsers } from "@/modules/seguridad/services/security-service";
import { getKpiSqlSource } from "@/modules/sql-data-sources/services/sql-source-service";
import { listDatabaseConnections } from "@/modules/sql-data-sources/services/connection-service";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ valor?: string; tab?: string }>;
}

export default async function KpiDetailPage({ params, searchParams }: PageProps) {
  if (!isSupabaseConfigured()) notFound();

  const { id } = await params;
  const { valor: initialSelectedFecha, tab: tabParam } = await searchParams;
  const initialTab: KpiDetailTab =
    tabParam === "metas" && !initialSelectedFecha ? "metas" : "seguimiento";

  try {
    const [
      kpi,
      versions,
      values,
      targets,
      trafficRanges,
      variables,
      formula,
      regions,
      hotels,
      categories,
      businessUnits,
      salesChannels,
      campaigns,
      teams,
      users,
      sqlSource,
      sqlConnections,
    ] = await Promise.all([
      getKpiById(id),
      listKpiVersions(id),
      listKpiValues(id),
      listTargets(id),
      listTrafficLightRanges(id),
      listVariables(),
      getKpiFormula(id),
      listRegions(),
      listHotels(),
      listKpiCategories(),
      listBusinessUnits(),
      listSalesChannels(),
      listMarketingCampaigns(),
      listCommercialTeams(),
      listUsers().catch(() => []),
      getKpiSqlSource(id).catch(() => null),
      listDatabaseConnections().catch(() => []),
    ]);

    const formulaVariableCodes = await getRequiredInputVariableCodes(id);
    const latestRange = trafficRanges[0] ?? null;

    const editDefaultValues: KpiCreateInput = {
      nombre: kpi.nombre,
      codigo: kpi.codigo,
      categoria_id: kpi.categoria_id,
      area_responsable: kpi.area_responsable,
      responsable_id: kpi.responsable_id,
      frecuencia: kpi.frecuencia,
      formula: kpi.formula,
      unidad_medida: kpi.unidad_medida,
      fuente_informacion: kpi.fuente_informacion,
      tipo_indicador: kpi.tipo_indicador,
      hotel_id: kpi.hotel_id,
      region_id: kpi.region_id,
      business_unit_id: kpi.business_unit_id,
      sales_channel_id: kpi.sales_channel_id,
      marketing_campaign_id: kpi.marketing_campaign_id,
      commercial_team_id: kpi.commercial_team_id,
      estado: (kpi.estado as "activo" | "inactivo") ?? "activo",
      recordatorio_email_activo:
        (kpi as { recordatorio_email_activo?: boolean }).recordatorio_email_activo ?? false,
      recordatorio_emails:
        (kpi as { recordatorio_emails?: string[] }).recordatorio_emails ?? [],
    };

    const responsableUser = users.find((u) => u.id === kpi.responsable_id);

    const dimensionCatalogs = {
      regions: regions.map((r) => ({ id: r.id, nombre: r.nombre })),
      hotels: hotels.map((h) => ({ id: h.id, nombre: h.nombre })),
      businessUnits: businessUnits.map((b) => ({ id: b.id, nombre: b.nombre })),
      salesChannels: salesChannels.map((s) => ({ id: s.id, nombre: s.nombre })),
      campaigns: campaigns.map((c) => ({ id: c.id, nombre: c.nombre })),
      teams: teams.map((t) => ({ id: t.id, nombre: t.nombre })),
    };

    const targetsForMatch = mapRawTargetsForMatch(targets);
    const trafficLightRanges = latestRange
      ? {
          cumplimiento_min_pct: latestRange.cumplimiento_min_pct,
          riesgo_min_pct: latestRange.riesgo_min_pct,
          riesgo_max_pct: latestRange.riesgo_max_pct,
          incumplimiento_max_pct: latestRange.incumplimiento_max_pct,
        }
      : null;

    const enrichedValues = values.map((v) => {
      const base = {
        id: v.id,
        fecha: v.fecha,
        valor_real: Number(v.valor_real),
        hotel_id: v.hotel_id ?? null,
        region_id: v.region_id ?? null,
        marketing_campaign_id: v.marketing_campaign_id ?? null,
        business_unit_id: v.business_unit_id ?? null,
        sales_channel_id: v.sales_channel_id ?? null,
        commercial_team_id: v.commercial_team_id ?? null,
        scope_label: formatDimensionScopeLabel(v, dimensionCatalogs),
        variable_inputs:
          v.variable_inputs && typeof v.variable_inputs === "object"
            ? (v.variable_inputs as Record<string, number>)
            : null,
        attachments: v.attachments ?? (v as any).kpi_value_attachments ?? null,
      };
      return enrichKpiValueWithTargets(base, targetsForMatch, trafficLightRanges);
    });

    return (
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" />}>
        <KpiDetailView
          kpi={kpi}
          initialTab={initialTab}
          editDefaultValues={editDefaultValues}
          editCatalogs={{
            categories,
            regions,
            hotels,
            users: users.map((u) => ({
              id: u.id,
              nombre: [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email,
              email: u.email,
            })),
            businessUnits,
            salesChannels,
            campaigns,
            teams,
          }}
          dimensionCatalogs={dimensionCatalogs}
          recordatorioEmailActivo={
            (kpi as { recordatorio_email_activo?: boolean }).recordatorio_email_activo ?? false
          }
          recordatorioEmails={
            (kpi as { recordatorio_emails?: string[] }).recordatorio_emails ?? []
          }
          ultimoRecordatorioAt={
            (kpi as { ultimo_recordatorio_at?: string | null }).ultimo_recordatorio_at ?? null
          }
          responsableEmail={responsableUser?.email ?? null}
        versions={versions}
        values={enrichedValues}
        targets={targets}
        regions={regions.map((r) => ({ id: r.id, nombre: r.nombre }))}
        hotels={hotels.map((h) => ({ id: h.id, nombre: h.nombre }))}
        trafficLightRanges={trafficLightRanges}
        variables={variables.map((v) => ({
          id: v.id,
          codigo: v.codigo,
          nombre: v.nombre,
          tipo: v.tipo,
          formula_compuesta: v.formula_compuesta,
        }))}
        initialFormula={formula?.es_valida ? (formula.expresion ?? "") : ""}
        formulaVariableCodes={formulaVariableCodes}
        initialSelectedFecha={initialSelectedFecha}
        hasSqlSource={Boolean(sqlSource?.connection_id)}
        formulaVersion={formula?.es_valida ? formula.version : undefined}
        formulaValidatedAt={formula?.es_valida ? formula.validada_at : undefined}
        registeredValuesCount={values.length}
        sqlConnections={sqlConnections.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
        }))}
        />
      </Suspense>
    );
  } catch {
    notFound();
  }
}

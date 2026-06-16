import { notFound } from "next/navigation";
import {
  getKpiById,
  listKpiVersions,
  listKpiValues,
} from "@/modules/kpis/services/kpi-service";
import { KpiDetailView } from "@/modules/kpis/components/kpi-detail-view";
import { listTargets, listTrafficLightRanges } from "@/modules/metas/services/targets-service";
import { listVariables, getKpiFormula } from "@/modules/formulas/services/formula-service";
import { listRegions, listHotels } from "@/modules/catalog";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KpiDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) notFound();

  const { id } = await params;
  try {
    const [kpi, versions, values, targets, trafficRanges, variables, formula, regions, hotels] =
      await Promise.all([
        getKpiById(id),
        listKpiVersions(id),
        listKpiValues(id),
        listTargets(id),
        listTrafficLightRanges(id),
        listVariables(),
        getKpiFormula(id),
        listRegions(),
        listHotels(),
      ]);

    const latestRange = trafficRanges[0] ?? null;

    return (
      <KpiDetailView
        kpi={kpi}
        versions={versions}
        values={values}
        targets={targets}
        regions={regions.map((r) => ({ id: r.id, nombre: r.nombre }))}
        hotels={hotels.map((h) => ({ id: h.id, nombre: h.nombre }))}
        trafficLightRanges={
          latestRange
            ? {
                cumplimiento_min_pct: latestRange.cumplimiento_min_pct,
                riesgo_min_pct: latestRange.riesgo_min_pct,
                riesgo_max_pct: latestRange.riesgo_max_pct,
                incumplimiento_max_pct: latestRange.incumplimiento_max_pct,
              }
            : null
        }
        variables={variables.map((v) => ({
          id: v.id,
          codigo: v.codigo,
          nombre: v.nombre,
          tipo: v.tipo,
        }))}
        initialFormula={formula?.expresion ?? ""}
      />
    );
  } catch {
    notFound();
  }
}

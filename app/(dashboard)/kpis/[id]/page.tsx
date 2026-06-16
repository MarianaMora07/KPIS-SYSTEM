import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getKpiById,
  listKpiVersions,
  listKpiValues,
} from "@/modules/kpis/services/kpi-service";
import { KpiDetailView } from "@/modules/kpis/components/kpi-detail-view";
import { listTargets } from "@/modules/metas/services/targets-service";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KpiDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) notFound();

  const { id } = await params;
  try {
    const [kpi, versions, values, targets] = await Promise.all([
      getKpiById(id),
      listKpiVersions(id),
      listKpiValues(id),
      listTargets(id),
    ]);

    return (
      <KpiDetailView
        kpi={kpi}
        versions={versions}
        values={values}
        targets={targets}
      />
    );
  } catch {
    notFound();
  }
}

import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requireKpiEditAccess } from "@/lib/auth/require-permission";
import { getKpiById } from "@/modules/kpis/services/kpi-service";
import { KpiEditForm } from "@/modules/kpis/components/kpi-edit-form";
import {
  listKpiCategories,
  listRegions,
  listHotels,
  listBusinessUnits,
  listSalesChannels,
  listMarketingCampaigns,
  listCommercialTeams,
} from "@/modules/catalog";
import { listUsers } from "@/modules/seguridad/services/security-service";
import type { KpiCreateInput } from "@/lib/validations/schemas";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KpiEditPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) notFound();

  const { id } = await params;
  try {
    const kpi = await getKpiById(id);
    await requireKpiEditAccess(kpi.hotel_id);

    const [
      categories,
      regions,
      hotels,
      users,
      businessUnits,
      salesChannels,
      campaigns,
      teams,
    ] = await Promise.all([
      listKpiCategories(),
      listRegions(),
      listHotels(),
      listUsers().catch(() => []),
      listBusinessUnits(),
      listSalesChannels(),
      listMarketingCampaigns(),
      listCommercialTeams(),
    ]);

    const defaultValues: KpiCreateInput = {
      nombre: kpi.nombre,
      codigo: kpi.codigo,
      categoria_id: kpi.categoria_id,
      area_responsable: kpi.area_responsable,
      responsable_id: kpi.responsable_id,
      frecuencia: kpi.frecuencia,
      formula: kpi.formula,
      unidad_medida: kpi.unidad_medida,
      meta: kpi.meta,
      fuente_informacion: kpi.fuente_informacion,
      tipo_indicador: kpi.tipo_indicador,
      hotel_id: kpi.hotel_id,
      region_id: kpi.region_id,
      business_unit_id: kpi.business_unit_id,
      sales_channel_id: kpi.sales_channel_id,
      marketing_campaign_id: kpi.marketing_campaign_id,
      commercial_team_id: kpi.commercial_team_id,
      estado: (kpi.estado as "activo" | "inactivo") ?? "activo",
    };

    return (
      <KpiEditForm
        kpiId={id}
        defaultValues={defaultValues}
        catalogs={{
          categories,
          regions,
          hotels,
          users: users.map((u) => ({
            id: u.id,
            nombre: [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email,
          })),
          businessUnits,
          salesChannels,
          campaigns,
          teams,
        }}
      />
    );
  } catch {
    notFound();
  }
}

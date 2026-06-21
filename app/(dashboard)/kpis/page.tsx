import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/require-permission";
import { listKpis } from "@/modules/kpis/services/kpi-service";
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
import { listVariables } from "@/modules/formulas/services/formula-service";
import { KpisTabsView } from "@/modules/kpis/components/kpis-tabs-view";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

interface KpisPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function KpisPage({ searchParams }: KpisPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-sm text-amber-800">
          Configure Supabase en <code>.env.local</code> y ejecute las migraciones
          para gestionar KPIs. Inicie sesión en{" "}
          <a href="/login" className="underline">
            /login
          </a>
          .
        </p>
      </div>
    );
  }

  await requirePermission("kpis.ver");

  const params = await searchParams;

  const [
    kpis,
    categories,
    regions,
    hotels,
    users,
    businessUnits,
    salesChannels,
    campaigns,
    teams,
    variables,
  ] = await Promise.all([
    listKpis(),
    listKpiCategories(),
    listRegions(),
    listHotels(),
    listUsers().catch(() => []),
    listBusinessUnits(),
    listSalesChannels(),
    listMarketingCampaigns(),
    listCommercialTeams(),
    listVariables(),
  ]);

  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-slate-100" />}>
      <KpisTabsView
        kpis={kpis}
        variables={variables.map((v) => ({
          id: v.id,
          codigo: v.codigo,
          nombre: v.nombre,
          tipo: v.tipo,
          unidad_medida: v.unidad_medida,
          formula_compuesta: v.formula_compuesta,
        }))}
        categories={categories}
        regions={regions}
        hotels={hotels}
        users={users.map((u) => ({
          id: u.id,
          nombre: [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email,
        }))}
        businessUnits={businessUnits}
        salesChannels={salesChannels}
        campaigns={campaigns}
        teams={teams}
        initialTab={params.tab === "variables" ? "variables" : "indicadores"}
      />
    </Suspense>
  );
}

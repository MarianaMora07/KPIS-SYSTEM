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
import { KpiList } from "@/modules/kpis/components/kpi-list";
import { KpisPageToolbar } from "@/modules/kpis/components/kpis-page-toolbar";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export default async function KpisPage() {
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
  ]);

  return (
    <div className="space-y-6">
      <KpisPageToolbar
        kpis={kpis.map((k) => ({
          id: k.id,
          codigo: k.codigo,
          nombre: k.nombre,
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
      />
      <KpiList kpis={kpis} />
    </div>
  );
}

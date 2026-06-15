import { listKpis } from "@/modules/kpis/services/kpi-service";
import { listKpiCategories, listRegions, listHotels } from "@/modules/catalog";
import { KpiList } from "@/modules/kpis/components/kpi-list";
import { KpiCreateForm } from "@/modules/kpis/components/kpi-create-form";
import { RegisterValueForm } from "@/modules/kpis/components/register-value-form";
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

  const [kpis, categories, regions, hotels] = await Promise.all([
    listKpis(),
    listKpiCategories(),
    listRegions(),
    listHotels(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <KpiCreateForm
          categories={categories}
          regions={regions}
          hotels={hotels}
        />
        <RegisterValueForm
          kpis={kpis.map((k) => ({
            id: k.id,
            codigo: k.codigo,
            nombre: k.nombre,
          }))}
        />
      </div>
      <KpiList kpis={kpis} />
    </div>
  );
}

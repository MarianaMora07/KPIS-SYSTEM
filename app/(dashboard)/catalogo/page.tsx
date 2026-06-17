import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requirePermission } from "@/lib/auth/require-permission";
import { listRegions, listHotels } from "@/modules/catalog";
import { CatalogView } from "@/modules/catalog/components/catalog-view";

export default async function CatalogoPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-800">
        Configure Supabase para administrar el catálogo organizacional.
      </div>
    );
  }

  await requirePermission("catalogo.ver");

  const [regions, hotels] = await Promise.all([listRegions(), listHotels()]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Jerarquía organizacional: regiones, hoteles y entidades asociadas a KPIs.
      </p>
      <CatalogView regions={regions} hotels={hotels} />
    </div>
  );
}

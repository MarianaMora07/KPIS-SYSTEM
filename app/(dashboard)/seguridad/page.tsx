import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { canAccessSeguridad } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/get-session-user";
import {
  listUsers,
  listAuditLogs,
  listPermissions,
} from "@/modules/seguridad/services/security-service";
import { SeguridadView } from "@/modules/seguridad/components/seguridad-view";
import { listRegions, listHotels } from "@/modules/catalog";
import { DEMO_REGIONS, DEMO_HOTELS } from "@/modules/dashboard/data/demo-data";

export default async function SeguridadPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-sm text-amber-800">
          Configure Supabase para gestionar seguridad y auditoría.
        </p>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!canAccessSeguridad(user?.rol ?? null)) {
    redirect("/dashboard");
  }

  const [users, auditLogs, permissions, regions, hotels] = await Promise.all([
    listUsers(),
    listAuditLogs(),
    listPermissions(),
    listRegions().catch(() => DEMO_REGIONS),
    listHotels().catch(() => DEMO_HOTELS),
  ]);

  return (
    <SeguridadView
      users={users}
      auditLogs={auditLogs}
      permissions={permissions}
      regions={regions.map((r) => ({ id: r.id, nombre: r.nombre }))}
      hotels={hotels.map((h) => ({ id: h.id, nombre: h.nombre }))}
    />
  );
}

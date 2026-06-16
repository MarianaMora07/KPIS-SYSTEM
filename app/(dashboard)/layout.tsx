import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PermissionsProvider } from "@/components/layout/permissions-context";
import { listRegions, listHotels } from "@/modules/catalog";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { canAccessSeguridad, getUserPermissions } from "@/lib/auth/permissions";
import { DEMO_REGIONS, DEMO_HOTELS } from "@/modules/dashboard/data/demo-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemoMode = !isSupabaseConfigured();
  let regions = DEMO_REGIONS;
  let hotels = DEMO_HOTELS;
  let user = null;
  let permissions: string[] = [];
  let rol = null;

  if (!isDemoMode) {
    try {
      const [r, h, u, perms] = await Promise.all([
        listRegions(),
        listHotels(),
        getSessionUser(),
        getUserPermissions(),
      ]);
      regions = r;
      hotels = h;
      user = u;
      permissions = perms.permissions;
      rol = perms.rol;
    } catch {
      // fallback demo catalog
    }
  }

  return (
    <PermissionsProvider permissions={permissions} rol={rol} isDemoMode={isDemoMode}>
      <DashboardShell
        regions={regions}
        hotels={hotels.map((h) => ({
          id: h.id,
          nombre: h.nombre,
          region_id: "region_id" in h ? (h as { region_id: string }).region_id : undefined,
        }))}
        user={user}
        permissions={permissions}
        canAccessAdmin={canAccessSeguridad(user?.rol ?? null)}
        isDemoMode={isDemoMode}
      >
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}

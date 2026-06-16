import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PermissionsProvider } from "@/components/layout/permissions-context";
import { listRegions, listHotels } from "@/modules/catalog";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { canAccessSeguridad, getUserPermissions } from "@/lib/auth/permissions";
import { DEMO_REGIONS, DEMO_HOTELS } from "@/modules/dashboard/data/demo-data";
import type { AppRole } from "@/types/database";

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
  let rol: AppRole | null = null;

  if (!isDemoMode) {
    const [u, perms] = await Promise.all([getSessionUser(), getUserPermissions()]);
    user = u;
    permissions = perms.permissions;
    rol = perms.rol ?? u?.rol ?? null;

    try {
      const [r, h] = await Promise.all([listRegions(), listHotels()]);
      regions = r;
      hotels = h;
    } catch (err) {
      console.error("[DashboardLayout] catalog load failed:", err);
    }
  }

  const effectiveRol = rol ?? user?.rol ?? null;

  return (
    <PermissionsProvider permissions={permissions} rol={effectiveRol} isDemoMode={isDemoMode}>
      <DashboardShell
        regions={regions}
        hotels={hotels.map((h) => ({
          id: h.id,
          nombre: h.nombre,
          region_id: "region_id" in h ? (h as { region_id: string }).region_id : undefined,
        }))}
        user={user}
        permissions={permissions}
        canAccessAdmin={canAccessSeguridad(effectiveRol)}
        isDemoMode={isDemoMode}
      >
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { listRegions, listHotels } from "@/modules/catalog";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { DEMO_REGIONS, DEMO_HOTELS } from "@/modules/dashboard/data/demo-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let regions = DEMO_REGIONS;
  let hotels = DEMO_HOTELS;
  let user = null;

  if (isSupabaseConfigured()) {
    try {
      [regions, hotels, user] = await Promise.all([
        listRegions(),
        listHotels(),
        getSessionUser(),
      ]);
    } catch {
      // fallback demo catalog
    }
  }

  return (
    <DashboardShell regions={regions} hotels={hotels} user={user}>
      {children}
    </DashboardShell>
  );
}

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  DEMO_DASHBOARD_DATA,
  filterDemoData,
} from "@/modules/dashboard/data/demo-data";
import { getDashboardKpis } from "@/modules/dashboard/services/dashboard-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    regionId: searchParams.get("region") ?? undefined,
    hotelId: searchParams.get("hotel") ?? undefined,
    fechaDesde: searchParams.get("desde") ?? "2026-06-01",
    fechaHasta: searchParams.get("hasta") ?? "2026-06-30",
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(filterDemoData(DEMO_DASHBOARD_DATA, filters));
  }

  try {
    const rows = await getDashboardKpis(filters);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(filterDemoData(DEMO_DASHBOARD_DATA, filters));
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  DEMO_DASHBOARD_DATA,
  filterDemoData,
} from "@/modules/dashboard/data/demo-data";

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

  const supabase = await createClient();
  let query = supabase
    .from("v_dashboard_kpis")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(50);

  if (filters.hotelId) query = query.eq("hotel_id", filters.hotelId);
  if (filters.regionId) query = query.eq("region_id", filters.regionId);
  if (filters.fechaDesde) query = query.gte("fecha", filters.fechaDesde);
  if (filters.fechaHasta) query = query.lte("fecha", filters.fechaHasta);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      filterDemoData(DEMO_DASHBOARD_DATA, filters)
    );
  }

  return NextResponse.json(data);
}

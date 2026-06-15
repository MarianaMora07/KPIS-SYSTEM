import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get("region") ?? undefined;
  const hotelId = searchParams.get("hotel") ?? undefined;
  const fechaDesde = searchParams.get("desde") ?? undefined;
  const fechaHasta = searchParams.get("hasta") ?? undefined;

  const supabase = await createClient();
  let query = supabase
    .from("v_dashboard_kpis")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(50);

  if (hotelId) query = query.eq("hotel_id", hotelId);
  if (regionId) query = query.eq("region_id", regionId);
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

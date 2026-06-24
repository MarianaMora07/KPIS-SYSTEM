import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserPermissions } from "@/lib/auth/permissions";
import { AprobacionesClient } from "./aprobaciones-client";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado");
  }
  return createSupabaseClient(url, serviceRoleKey);
}

export default async function AprobacionesPage() {
  const { rol } = await getUserPermissions();
  const isApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(rol || "");

  if (!isApprover) {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();
  const { data: requests, error } = await adminClient
    .from("kpi_approval_requests")
    .select(`
      *,
      solicitante:user_profiles!solicitante_id(nombre, apellido, email),
      aprobador:user_profiles!aprobador_id(nombre, apellido, email),
      hotel:hotels(nombre),
      kpi:kpis(nombre, codigo)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AprobacionesPage] Error loading requests:", error);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AprobacionesClient initialRequests={(requests ?? []) as any} />
    </div>
  );
}

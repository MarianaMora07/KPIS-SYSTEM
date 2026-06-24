import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserPermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
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

  const isGlobalApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(rol || "");
  const isGerenteHotel = rol === "gerente_hotel";

  if (!isGlobalApprover && !isGerenteHotel) {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();

  if (isGerenteHotel) {
    // --- Vista del Gerente: solicitudes pendientes SOLO de su hotel ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Obtener el hotel asignado al gerente
    const { data: gerenteScopes } = await supabase
      .from("user_hotel_scopes")
      .select("hotel_id, hotels(nombre)")
      .eq("user_id", user.id);

    const gerenteHotelId = gerenteScopes?.[0]?.hotel_id ?? null;
    const gerenteHotelNombre =
      ((gerenteScopes?.[0]?.hotels as any)?.nombre as string) ?? "Mi Hotel";

    if (!gerenteHotelId) {
      // El gerente no tiene hotel asignado, no puede ver aprobaciones
      return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <p className="font-semibold text-amber-800">Sin hotel asignado</p>
            <p className="mt-1 text-sm text-amber-700">
              No tiene un hotel asignado en el sistema. Contacte al administrador.
            </p>
          </div>
        </div>
      );
    }

    const { data: requests, error } = await adminClient
      .from("kpi_approval_requests")
      .select(`
        *,
        solicitante:user_profiles!solicitante_id(nombre, apellido, email),
        aprobador:user_profiles!aprobador_id(nombre, apellido, email),
        hotel:hotels(nombre),
        kpi:kpis(nombre, codigo)
      `)
      .eq("hotel_id", gerenteHotelId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AprobacionesPage] Error loading gerente requests:", error);
    }

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AprobacionesClient
          initialRequests={(requests ?? []) as any}
          userRole="gerente_hotel"
          gerenteHotelNombre={gerenteHotelNombre}
          gerentesMap={{}}
        />
      </div>
    );
  }

  // --- Vista del Administrador / Director: TODAS las solicitudes ---
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

  // Construir mapa de gerentes responsables por hotel_id
  // Obtener todos los hotel_ids únicos de las solicitudes
  const uniqueHotelIds = [
    ...new Set((requests ?? []).map((r: any) => r.hotel_id).filter(Boolean)),
  ] as string[];

  const gerentesMap: Record<string, { nombre: string; apellido: string; email: string }[]> = {};

  if (uniqueHotelIds.length > 0) {
    // Buscar todos los gerentes de esos hoteles en una sola query
    const { data: gerentesData, error: gerentesError } = await adminClient
      .from("user_hotel_scopes")
      .select(`
        hotel_id,
        user:user_profiles!user_hotel_scopes_user_id_fkey(id, nombre, apellido, email),
        user_roles:user_roles!user_roles_user_id_fkey(rol)
      `)
      .in("hotel_id", uniqueHotelIds);

    if (gerentesError) {
      console.error("[AprobacionesPage] Error loading gerentes:", gerentesError);
    }

    // Filtrar solo los que tienen rol gerente_hotel y agrupar por hotel_id
    for (const scope of gerentesData ?? []) {
      const roles = scope.user_roles as { rol: string }[] | { rol: string } | null;
      const roleList = Array.isArray(roles) ? roles : roles ? [roles] : [];
      const isGerente = roleList.some((r) => r.rol === "gerente_hotel");
      if (!isGerente) continue;

      const profile = scope.user as any as { id: string; nombre: string; apellido: string; email: string } | null;
      if (!profile) continue;

      const hid = scope.hotel_id as string;
      if (!gerentesMap[hid]) gerentesMap[hid] = [];
      gerentesMap[hid].push({
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email,
      });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AprobacionesClient
        initialRequests={(requests ?? []) as any}
        userRole={rol as any}
        gerenteHotelNombre={null}
        gerentesMap={gerentesMap}
      />
    </div>
  );
}

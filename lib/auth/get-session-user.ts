import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session-user";
import type { AppRole } from "@/types/database";
import { getAuthUser } from "@/lib/auth/cached-auth";

async function fetchSessionUser(): Promise<SessionUser | null> {
  const user = await getAuthUser();

  if (!user) return null;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, email, nombre, apellido, avatar_url, user_roles!user_roles_user_id_fkey(rol)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? "",
      nombre: user.user_metadata?.nombre ?? user.email?.split("@")[0] ?? "Usuario",
      apellido: null,
      avatar_url: null,
      rol: null,
    };
  }

  const roles = profile.user_roles as { rol: AppRole }[] | { rol: AppRole } | null;
  const rol = Array.isArray(roles) ? roles[0]?.rol ?? null : roles?.rol ?? null;

  return {
    id: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    apellido: profile.apellido,
    avatar_url: profile.avatar_url ?? null,
    rol,
  };
}

export const getSessionUser = cache(fetchSessionUser);

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { ProfileView } from "@/modules/perfil/components/profile-view";

export default async function PerfilPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-800">
        Configure Supabase para acceder al perfil de usuario.
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <ProfileView user={user} />;
}

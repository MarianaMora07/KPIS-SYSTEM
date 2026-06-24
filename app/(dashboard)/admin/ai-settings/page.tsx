import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import {
  getAiConfigurations,
  getAiProviders,
  getAiUsageMetrics,
} from "./actions/ai-settings-actions";
import { AiSettingsTabs } from "./components/AiSettingsTabs";

export const metadata = {
  title: "Motores de IA — Hoteles Estelar KPI",
  description:
    "Gestión administrativa de proveedores de IA, API Keys cifradas y métricas de consumo de tokens.",
};

export default async function AiSettingsPage() {
  // Guard: solo ADMIN puede acceder a esta página
  const isDemoMode = !isSupabaseConfigured();

  if (!isDemoMode) {
    const user = await getSessionUser();
    if (!user || user.rol !== "administrador") {
      redirect("/dashboard");
    }
  }

  // Cargar datos en paralelo en el servidor
  const [configurations, providers, metrics] = await Promise.all([
    getAiConfigurations().catch(() => []),
    getAiProviders().catch(() => []),
    getAiUsageMetrics().catch(() => ({
      daily: [],
      byModule: [],
      quotas: [],
    })),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-imperial-900 text-white shadow-sm">
              🤖
            </span>
            <h2 className="text-lg font-bold tracking-tight text-imperial-900">
              Motores de IA
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Administra las credenciales cifradas y monitorea el consumo de
            tokens de los proveedores de inteligencia artificial.
          </p>
        </div>

        {isDemoMode && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            ⚠️ Modo Demo — Cambios no persisten
          </span>
        )}
      </div>

      {/* Tabs */}
      <AiSettingsTabs
        configurations={configurations}
        providers={providers}
        metrics={metrics}
      />
    </div>
  );
}

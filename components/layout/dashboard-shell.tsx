"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Sidebar } from "@/components/layout/sidebar";
import { HeaderFiltersWrapper } from "@/components/layout/header-filters-wrapper";
import { RoleBadge } from "@/components/ui/role-badge";
import { createClient } from "@/lib/supabase/client";
import { UserCircle } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session-user";

const PAGE_TITLES: Record<
  string,
  { title: string; subtitle?: string; showFilters?: boolean }
> = {
  "/dashboard": {
    title: "Dashboard Ejecutivo",
    subtitle: "Desempeño comercial y de mercadeo en tiempo real",
    showFilters: true,
  },
  "/kpis": {
    title: "Administración de KPIs",
    subtitle: "Crear, editar y configurar indicadores (HU-KPI-001)",
    showFilters: false,
  },
  "/import": {
    title: "Importar información",
    subtitle: "Carga masiva desde Excel o CSV (HU-KPI-004)",
    showFilters: false,
  },
  "/integraciones": {
    title: "Integraciones externas",
    subtitle: "PMS, CRM, ERP y APIs (HU-KPI-005)",
    showFilters: false,
  },
  "/alertas": {
    title: "Alertas y seguimiento",
    subtitle: "Notificaciones y planes de acción (HU-KPI-008 / HU-KPI-009)",
    showFilters: true,
  },
  "/reportes": {
    title: "Reportes ejecutivos",
    subtitle: "Exportación PDF, Excel y PowerPoint (HU-KPI-010)",
    showFilters: true,
  },
  "/seguridad": {
    title: "Seguridad y auditoría",
    subtitle: "Usuarios, permisos y bitácora (HU-KPI-011 / HU-KPI-012)",
    showFilters: false,
  },
  "/perfil": {
    title: "Mi perfil",
    subtitle: "Información personal y seguridad de la cuenta",
    showFilters: false,
  },
};

interface DashboardShellProps {
  children: React.ReactNode;
  regions?: { id: string; nombre: string }[];
  hotels?: { id: string; nombre: string }[];
  user?: SessionUser | null;
}

export function DashboardShell({
  children,
  regions = [],
  hotels = [],
  user,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageConfig = PAGE_TITLES[pathname] ?? PAGE_TITLES["/dashboard"];
  const { title, subtitle, showFilters = false } = pageConfig;
  const [collapsed, setCollapsed] = useState(false);

  const displayName = user
    ? [user.nombre, user.apellido].filter(Boolean).join(" ")
    : "Usuario";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200/80 bg-white/90 px-6 py-3 backdrop-blur-md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-imperial-900">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {showFilters && (
                <HeaderFiltersWrapper regions={regions} hotels={hotels} />
              )}

              {user && (
                <Link
                  href="/perfil"
                  className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-white">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={displayName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserCircle className="h-6 w-6 text-white/90" />
                      </div>
                    )}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-sm font-medium text-imperial-900">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  {user.rol && (
                    <RoleBadge role={user.rol} variant="light" className="hidden md:inline-flex" />
                  )}
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

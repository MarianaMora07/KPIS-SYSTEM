"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Sidebar } from "@/components/layout/sidebar";
import { HeaderFiltersWrapper } from "@/components/layout/header-filters-wrapper";
import { NotificationBell } from "@/components/layout/notification-bell";
import { RoleBadge } from "@/components/ui/role-badge";
import { createClient } from "@/lib/supabase/client";
import { UserCircle } from "lucide-react";
import { hasPermissionInList } from "@/lib/auth/role-matrix";
import type { SessionUser } from "@/lib/auth/session-user";

const PAGE_TITLES: Record<
  string,
  { title: string; subtitle?: string; showFilters?: boolean }
> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Resumen de indicadores y cumplimiento por meta",
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
  "/catalogo": {
    title: "Catálogo organizacional",
    subtitle: "Regiones, hoteles y jerarquía (HU-KPI-001)",
    showFilters: false,
  },
  "/seguridad": {
    title: "Seguridad",
    subtitle: "Usuarios, roles y permisos (HU-KPI-011)",
    showFilters: false,
  },
  "/auditoria": {
    title: "Auditoría",
    subtitle: "Bitácora de trazabilidad del sistema (HU-KPI-012)",
    showFilters: false,
  },
  "/admin/ai-settings": {
    title: "Motores de IA",
    subtitle: "Gestiona proveedores, API Keys cifradas y métricas de consumo",
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
  permissions?: string[];
  isDemoMode?: boolean;
}

export function DashboardShell({
  children,
  regions = [],
  hotels = [],
  user,
  permissions = [],
  isDemoMode = false,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageConfig = PAGE_TITLES[pathname] ?? PAGE_TITLES["/dashboard"];
  const { title, subtitle, showFilters = false } = pageConfig;
  const [collapsed, setCollapsed] = useState(false);

  const displayName = user
    ? [user.nombre, user.apellido].filter(Boolean).join(" ")
    : "Usuario";

  const showNotificationBell =
    isDemoMode || hasPermissionInList(permissions, "alertas.ver");

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
        permissions={permissions}
        isDemoMode={isDemoMode}
        rol={user?.rol ?? null}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200/80 bg-white/90 px-6 py-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight text-imperial-900">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 text-sm leading-snug text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {showNotificationBell && <NotificationBell />}

              {user && (
                <Link
                  href="/perfil"
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 transition-colors hover:border-imperial-700/30 hover:bg-imperial-900/5 sm:gap-3 sm:px-3"
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-imperial-900 ring-2 ring-white sm:h-9 sm:w-9">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={displayName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserCircle className="h-5 w-5 text-white/90 sm:h-6 sm:w-6" />
                      </div>
                    )}
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <p className="max-w-[140px] truncate text-sm font-medium text-imperial-900">
                      {displayName}
                    </p>
                    <p className="max-w-[140px] truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  {user.rol && (
                    <RoleBadge
                      role={user.rol}
                      variant="light"
                      className="hidden xl:inline-flex"
                    />
                  )}
                </Link>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
              <HeaderFiltersWrapper regions={regions} hotels={hotels} />
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

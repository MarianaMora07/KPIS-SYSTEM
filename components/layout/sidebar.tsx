"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Target,
  Upload,
  Plug,
  Bell,
  FileBarChart,
  Shield,
  UserCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.ver" },
  { href: "/kpis", label: "KPIs", icon: Target, perm: "kpis.ver" },
  { href: "/import", label: "Importar", icon: Upload, perm: "import.cargar" },
  { href: "/integraciones", label: "Integraciones", icon: Plug, perm: "integraciones.gestionar" },
  { href: "/alertas", label: "Alertas", icon: Bell, perm: "alertas.ver" },
  { href: "/reportes", label: "Reportes", icon: FileBarChart, perm: "reportes.exportar" },
  { href: "/catalogo", label: "Catálogo", icon: Building2, perm: "catalogo.ver" },
  { href: "/seguridad", label: "Seguridad", icon: Shield, perm: "usuarios.gestionar" },
  { href: "/perfil", label: "Mi perfil", icon: UserCircle },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  permissions?: string[];
  isDemoMode?: boolean;
}

export function Sidebar({
  collapsed,
  onToggle,
  onLogout,
  permissions = [],
  isDemoMode = false,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className={cn(
        "group/sidebar relative flex h-full shrink-0 flex-col",
        "border-r border-white/10 bg-imperial-900 text-white"
      )}
    >
      <Link
        href="/dashboard"
        className="flex flex-col items-center gap-2 border-b border-white/10 px-4 py-5"
      >
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          <Image
            src="/logo.svg"
            alt="Logo Estelar KPI"
            width={40}
            height={40}
            className="rounded-lg object-contain"
            priority
          />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-center"
            >
              <p className="text-sm font-semibold leading-tight">Hoteles Estelar</p>
              <p className="text-xs text-slate-400">Sistema de KPIs</p>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems
          .filter((item) => {
            if (
              item.perm &&
              !isDemoMode &&
              !permissions.includes(item.perm)
            ) {
              return false;
            }
            return true;
          })
          .map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-l-2 border-white bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            "text-red-300 hover:bg-red-500/10 hover:text-red-200",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        className={cn(
          "absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center",
          "rounded-full border border-slate-200/80 bg-white text-imperial-900 shadow-md",
          "opacity-0 transition-all duration-200",
          "group-hover/sidebar:opacity-100",
          "hover:scale-105 hover:border-imperial-700/30 hover:shadow-lg",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imperial-700/40"
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </motion.aside>
  );
}

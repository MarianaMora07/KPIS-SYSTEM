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
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kpis", label: "KPIs", icon: Target },
  { href: "/import", label: "Importar", icon: Upload },
  { href: "/integraciones", label: "Integraciones", icon: Plug },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/seguridad", label: "Seguridad", icon: Shield },
  { href: "/perfil", label: "Mi perfil", icon: UserCircle },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export function Sidebar({ collapsed, onToggle, onLogout }: SidebarProps) {
  const pathname = usePathname();

  function handleEdgeInteraction() {
    if (collapsed) onToggle();
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className={cn(
        "relative flex h-full shrink-0 flex-col",
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
        {navItems.map(({ href, label, icon: Icon }) => {
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
                  ? "bg-gradient-to-r from-cyan-500/15 to-purple-500/15 text-cyan-300"
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
            "text-red-300 hover:bg-red-500/10 hover:text-red-200"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={handleEdgeInteraction}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        className={cn(
          "absolute right-0 top-0 z-10 flex h-full w-4 cursor-pointer",
          "items-center justify-center border-l border-white/15",
          "bg-imperial-800/90 text-slate-400 transition-colors",
          "hover:bg-imperial-700 hover:text-white"
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </motion.aside>
  );
}

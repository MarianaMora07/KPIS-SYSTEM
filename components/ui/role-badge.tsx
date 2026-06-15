import { cn } from "@/lib/utils/cn";
import type { AppRole } from "@/types/database";
import { getRoleLabel } from "@/lib/auth/roles";

const ROLE_STYLES: Record<AppRole, string> = {
  administrador: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  director_comercial: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  director_mercadeo: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  gerente_hotel: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  analista: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  consulta: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

interface RoleBadgeProps {
  role: AppRole;
  className?: string;
  variant?: "dark" | "light";
}

export function RoleBadge({ role, className, variant = "light" }: RoleBadgeProps) {
  const lightStyles: Record<AppRole, string> = {
    administrador: "bg-purple-100 text-purple-700 border-purple-200",
    director_comercial: "bg-cyan-100 text-cyan-700 border-cyan-200",
    director_mercadeo: "bg-pink-100 text-pink-700 border-pink-200",
    gerente_hotel: "bg-amber-100 text-amber-700 border-amber-200",
    analista: "bg-indigo-100 text-indigo-700 border-indigo-200",
    consulta: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "dark" ? ROLE_STYLES[role] : lightStyles[role],
        className
      )}
    >
      {getRoleLabel(role)}
    </span>
  );
}

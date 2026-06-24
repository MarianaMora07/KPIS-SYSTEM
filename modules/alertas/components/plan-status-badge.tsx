const PLAN_STATUS_STYLES: Record<
  string,
  { label: string; bg: string; dot: string; text: string }
> = {
  abierto: {
    label: "Abierto",
    bg: "bg-slate-100",
    dot: "bg-slate-400",
    text: "text-slate-700",
  },
  en_progreso: {
    label: "En progreso",
    bg: "bg-amber-100",
    dot: "bg-amber-500",
    text: "text-amber-800",
  },
  completado: {
    label: "Completado",
    bg: "bg-emerald-100",
    dot: "bg-emerald-500",
    text: "text-emerald-800",
  },
  cancelado: {
    label: "Cancelado",
    bg: "bg-slate-200",
    dot: "bg-slate-500",
    text: "text-slate-600",
  },
  vencido: {
    label: "Vencido",
    bg: "bg-red-100",
    dot: "bg-red-500",
    text: "text-red-800",
  },
};

export function getPlanStatusStyle(status: string) {
  return (
    PLAN_STATUS_STYLES[status] ?? {
      label: status,
      bg: "bg-slate-100",
      dot: "bg-slate-400",
      text: "text-slate-700",
    }
  );
}

export function PlanStatusBadge({ status }: { status: string }) {
  const s = getPlanStatusStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

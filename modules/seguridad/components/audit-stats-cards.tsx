import type { AuditStats } from "../lib/audit-stats";

const CARDS = [
  {
    key: "total" as const,
    label: "Total eventos",
    color: "text-imperial-900",
    dot: "bg-imperial-700",
    bg: "bg-slate-50 border-slate-200 text-slate-700",
  },
  {
    key: "crear" as const,
    label: "Creaciones",
    color: "text-emerald-600",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700",
  },
  {
    key: "actualizar" as const,
    label: "Actualizaciones",
    color: "text-amber-600",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20 text-amber-700",
  },
  {
    key: "eliminar" as const,
    label: "Eliminaciones",
    color: "text-red-600",
    dot: "bg-red-500",
    bg: "bg-red-500/10 border-red-500/20 text-red-700",
  },
];

export function AuditStatsCards({ stats }: { stats: AuditStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CARDS.map(({ key, label, color, dot, bg }) => (
        <div
          key={key}
          className="glass rounded-xl border border-slate-200/60 p-4 shadow-sm"
        >
          <div
            className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${bg}`}
          >
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {label}
          </div>
          <p className={`text-3xl font-extrabold ${color}`}>{stats[key]}</p>
        </div>
      ))}
    </div>
  );
}

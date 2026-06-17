import { isTargetExpired } from "@/lib/metas/target-status";

export function TargetExpiredBadge({
  fechaFin,
  className = "",
}: {
  fechaFin: string;
  className?: string;
}) {
  if (!isTargetExpired(fechaFin)) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 ${className}`}
    >
      Meta vencida
    </span>
  );
}

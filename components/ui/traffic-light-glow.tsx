import type { TrafficLightStatus } from "@/types/database";
import { cn } from "@/lib/utils/cn";

const glowStyles: Record<TrafficLightStatus, string> = {
  cumplimiento:
    "shadow-[0_0_20px_rgba(34,197,94,0.45)] ring-1 ring-emerald-400/30",
  riesgo:
    "shadow-[0_0_20px_rgba(234,179,8,0.45)] ring-1 ring-amber-400/30",
  incumplimiento:
    "shadow-[0_0_20px_rgba(239,68,68,0.45)] ring-1 ring-red-400/30",
};

const dotStyles: Record<TrafficLightStatus, string> = {
  cumplimiento: "bg-emerald-500",
  riesgo: "bg-amber-500",
  incumplimiento: "bg-red-500",
};

const labels: Record<TrafficLightStatus, string> = {
  cumplimiento: "Cumplimiento",
  riesgo: "Riesgo",
  incumplimiento: "Incumplimiento",
};

interface TrafficLightGlowProps {
  status: TrafficLightStatus;
  className?: string;
  showLabel?: boolean;
}

export function TrafficLightGlow({
  status,
  className,
  showLabel = true,
}: TrafficLightGlowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        "bg-white/80 backdrop-blur-sm",
        glowStyles[status],
        className
      )}
    >
      <span
        className={cn("h-2 w-2 rounded-full", dotStyles[status])}
        aria-hidden
      />
      {showLabel && (
        <span className="text-imperial-900">{labels[status]}</span>
      )}
    </span>
  );
}

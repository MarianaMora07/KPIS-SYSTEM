"use client";

import { motion } from "framer-motion";
import type { TrafficLightStatus } from "@/types/database";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import { cn } from "@/lib/utils/cn";

interface KpiCardProps {
  nombre: string;
  valor: string;
  meta?: string;
  variacion?: string;
  semaforo: TrafficLightStatus;
  index?: number;
  onClick?: () => void;
}

export function KpiCard({
  nombre,
  valor,
  meta,
  variacion,
  semaforo,
  index = 0,
  onClick,
}: KpiCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-xl border border-slate-200/70",
        "bg-white/80 p-5 backdrop-blur-md transition-shadow",
        "shadow-md shadow-slate-300/50",
        "hover:border-imperial-700/30 hover:shadow-lg hover:shadow-slate-400/40"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-600">{nombre}</h3>
        <TrafficLightGlow status={semaforo} />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-imperial-900">
        {valor}
      </p>
      {(meta || variacion) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          {meta && <span>Meta: {meta}</span>}
          {variacion && (
            <span className="text-amber-600">{variacion}</span>
          )}
        </div>
      )}
    </motion.article>
  );
}

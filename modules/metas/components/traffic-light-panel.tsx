"use client";

import { useState, useTransition } from "react";
import { saveTrafficLightAction } from "../actions/targets-actions";
import { TrafficLightGlow } from "@/components/ui/traffic-light-glow";
import type { TrafficLightStatus } from "@/types/database";

export function TrafficLightPanel({ kpiId }: { kpiId: string }) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(85);
  const [ranges, setRanges] = useState({
    cumplimiento_min_pct: 100,
    riesgo_min_pct: 80,
    riesgo_max_pct: 99.99,
    incumplimiento_max_pct: 79.99,
  });

  const status: TrafficLightStatus =
    preview >= ranges.cumplimiento_min_pct
      ? "cumplimiento"
      : preview >= ranges.riesgo_min_pct
        ? "riesgo"
        : "incumplimiento";

  return (
    <section className="glass rounded-xl border border-slate-200/60 p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
        Rangos semáforo
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(ranges).map(([key, val]) => (
          <label key={key} className="text-xs text-slate-600">
            {key.replace(/_/g, " ")}
            <input
              type="number"
              step="0.01"
              value={val}
              onChange={(e) =>
                setRanges((r) => ({ ...r, [key]: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4">
        <label className="text-sm">
          Vista previa %
          <input
            type="number"
            value={preview}
            onChange={(e) => setPreview(Number(e.target.value))}
            className="ml-2 w-20 rounded border px-2 py-1 text-sm"
          />
        </label>
        <TrafficLightGlow status={status} />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => saveTrafficLightAction(kpiId, ranges))}
        className="mt-4 rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white"
      >
        Guardar rangos
      </button>
    </section>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardKpiRow } from "@/modules/dashboard/types";

interface AiTrendSummaryCardProps {
  /** History rows filtered to the active KPI */
  history: DashboardKpiRow[];
  /** Human-readable name of the active KPI */
  kpiNombre: string;
  /** Optional filter labels for the prompt context */
  filters?: { periodo?: string; region?: string; hotel?: string };
}

type CardState = "idle" | "loading" | "success" | "error";

export function AiTrendSummaryCard({
  history,
  kpiNombre,
  filters,
}: AiTrendSummaryCardProps) {
  const [state, setState] = useState<CardState>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAnalyze() {
    if (history.length === 0) return;
    setState("loading");
    setSummary(null);
    setErrorMsg(null);

    // Build the rows payload for the API — include last 20 data points
    const rows = history.slice(0, 20).map((r) => ({
      kpi_nombre: r.kpi_nombre,
      hotel_nombre: r.hotel_nombre,
      valor_real: Number(r.valor_real),
      valor_meta: r.valor_meta != null ? Number(r.valor_meta) : null,
      cumplimiento_pct: r.cumplimiento_pct,
      semaforo_calculado: r.semaforo_calculado,
    }));

    try {
      const res = await fetch("/api/reportes/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, filters: filters ?? {} }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        summary?: string | null;
        error?: string;
      };

      if (!res.ok && data.error) {
        throw new Error(data.error);
      }

      if (!data.summary) {
        throw new Error("La IA no devolvió un resumen.");
      }

      setSummary(data.summary);
      setState("success");
    } catch (e) {
      setErrorMsg(
        e instanceof Error
          ? e.message
          : "No se pudo generar el análisis. Intente de nuevo."
      );
      setState("error");
    }
  }

  function handleReset() {
    setState("idle");
    setSummary(null);
    setErrorMsg(null);
  }

  return (
    <div className="glass overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-indigo-100/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-200">
            <BrainCircuit className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              Resumen Ejecutivo de IA
            </h3>
            <p className="text-[11px] text-indigo-500/80">
              Análisis narrativo de tendencia — {kpiNombre}
            </p>
          </div>
        </div>

        {state === "success" && (
          <button
            type="button"
            onClick={handleReset}
            title="Nuevo análisis"
            className="flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            <RefreshCw className="h-3 w-3" />
            Nuevo
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="px-5 py-4">
        <AnimatePresence mode="wait">
          {/* IDLE: Show trigger button */}
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-2 text-center"
            >
              <p className="max-w-xs text-xs text-slate-500">
                Analiza los últimos{" "}
                <strong>{Math.min(history.length, 20)}</strong> registros del KPI
                y genera un párrafo ejecutivo sobre la tendencia.
              </p>
              <button
                type="button"
                id="btn-analizar-tendencia-ia"
                onClick={handleAnalyze}
                disabled={history.length === 0}
                className="group flex items-center gap-2 rounded-xl border border-indigo-300 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-700 hover:to-violet-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                Analizar Tendencia Actual
              </button>
            </motion.div>
          )}

          {/* LOADING: Skeleton pulse */}
          {state === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2.5 py-1"
            >
              <div className="flex items-center gap-2 pb-1">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-xs font-medium text-indigo-600">
                  Analizando tendencias con IA…
                </span>
              </div>
              <Skeleton className="h-3.5 w-full bg-indigo-100/80" />
              <Skeleton className="h-3.5 w-5/6 bg-indigo-100/80" />
              <Skeleton className="h-3.5 w-4/5 bg-indigo-100/80" />
              <Skeleton className="h-3.5 w-3/4 bg-indigo-100/80" />
            </motion.div>
          )}

          {/* SUCCESS: Render AI text */}
          {state === "success" && summary && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-[13px] leading-relaxed text-slate-700">
                {summary}
              </p>
              <p className="mt-3 text-[10px] text-indigo-400">
                Generado por IA · Basado en datos históricos del sistema
              </p>
            </motion.div>
          )}

          {/* ERROR: Show error with retry */}
          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-2 text-center"
            >
              <p className="text-xs text-red-600">{errorMsg}</p>
              <button
                type="button"
                onClick={handleAnalyze}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3" />
                Reintentar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

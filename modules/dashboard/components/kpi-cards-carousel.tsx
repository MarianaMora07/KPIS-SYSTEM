"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  formatKpiValue,
  formatVariacion,
  type DashboardKpiRow,
} from "@/modules/dashboard/types";
import type { TrafficLightStatus } from "@/types/database";

const PAGE_SIZE = 4;

interface KpiCardsCarouselProps {
  cards: DashboardKpiRow[];
  onCardClick: (kpi: DashboardKpiRow) => void;
}

export function KpiCardsCarousel({ cards, onCardClick }: KpiCardsCarouselProps) {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const showCarousel = cards.length > PAGE_SIZE;
  const totalPages = Math.ceil(cards.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visibleCards = showCarousel ? cards.slice(start, start + PAGE_SIZE) : cards;

  useEffect(() => {
    setPage(0);
    setDirection(0);
  }, [cards]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  function goToPage(next: number) {
    setDirection(next > page ? 1 : -1);
    setPage(next);
  }

  const slideVariants = {
    enter: (slideDirection: number) => ({
      x: slideDirection > 0 ? 48 : -48,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (slideDirection: number) => ({
      x: slideDirection > 0 ? -48 : 48,
      opacity: 0,
    }),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2 sm:gap-3">
        {showCarousel && (
          <button
            type="button"
            aria-label="Indicadores anteriores"
            disabled={page === 0}
            onClick={() => goToPage(Math.max(0, page - 1))}
            className="flex shrink-0 items-center justify-center self-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-imperial-700/30 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={showCarousel ? page : "all"}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {visibleCards.map((kpi, index) => (
                <KpiCard
                  key={kpi.kpi_id}
                  nombre={kpi.kpi_nombre}
                  valor={formatKpiValue(Number(kpi.valor_real), kpi.unidad_medida)}
                  meta={
                    kpi.valor_meta != null
                      ? formatKpiValue(Number(kpi.valor_meta), kpi.unidad_medida)
                      : undefined
                  }
                  variacion={formatVariacion(
                    Number(kpi.valor_real),
                    kpi.valor_meta != null ? Number(kpi.valor_meta) : null,
                    kpi.unidad_medida
                  )}
                  semaforo={(kpi.semaforo_calculado ?? "riesgo") as TrafficLightStatus}
                  index={start + index}
                  onClick={() => onCardClick(kpi)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {showCarousel && (
          <button
            type="button"
            aria-label="Indicadores siguientes"
            disabled={page >= totalPages - 1}
            onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
            className="flex shrink-0 items-center justify-center self-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-imperial-700/30 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {showCarousel && (
        <p className="text-center text-xs text-slate-500">
          Mostrando {start + 1}–{Math.min(start + PAGE_SIZE, cards.length)} de {cards.length}{" "}
          indicadores · Página {page + 1} de {totalPages}
        </p>
      )}
    </div>
  );
}

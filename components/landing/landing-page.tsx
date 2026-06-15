"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Target,
  Zap,
  Shield,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const SLIDES = [
  {
    title: "Dashboard Ejecutivo",
    description:
      "Visualice KPIs comerciales y de mercadeo en tiempo real con semáforos, tendencias y comparativos por hotel y región.",
    gradient: "from-cyan-500/30 via-indigo-500/30 to-purple-500/30",
    icon: BarChart3,
  },
  {
    title: "Metas y Cumplimiento",
    description:
      "Configure metas mensuales, trimestrales y anuales. El sistema clasifica automáticamente en cumplimiento, riesgo o incumplimiento.",
    gradient: "from-purple-500/30 via-pink-500/30 to-rose-500/30",
    icon: Target,
  },
  {
    title: "Integración Inteligente",
    description:
      "Conecte PMS, CRM, ERP y fuentes externas. Automatice cálculos y elimine la dependencia de archivos Excel dispersos.",
    gradient: "from-blue-500/30 via-violet-500/30 to-fuchsia-500/30",
    icon: Zap,
  },
  {
    title: "Seguridad y Auditoría",
    description:
      "Control de acceso por roles, restricción geográfica por hotel/región y bitácora inmutable de cada cambio.",
    gradient: "from-emerald-500/20 via-cyan-500/30 to-indigo-500/30",
    icon: Shield,
  },
];

const FEATURES = [
  "KPIs estratégicos, tácticos y operativos",
  "Semaforización automática con alertas",
  "Importación masiva Excel / CSV",
  "Análisis histórico y proyecciones",
];

const SPARKLE_POSITIONS = [
  { top: "70.0000%", left: "105.0000%" },
  { top: "102.6214%", left: "72.4758%" },
  { top: "93.6412%", left: "35.3503%" },
  { top: "54.5118%", left: "62.6221%" },
  { top: "35.1342%", left: "103.6060%" },
  { top: "60.2205%", left: "82.1322%" },
] as const;

export function LandingPage() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % SLIDES.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = SLIDES[current];
  const Icon = slide.icon;

  return (
    <div className="relative min-h-screen overflow-hidden bg-landing-bg text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb animate-pulse-glow absolute -left-32 top-20 h-96 w-96 rounded-full" />
        <div className="glow-orb animate-pulse-glow absolute -right-32 bottom-20 h-80 w-80 rounded-full" style={{ animationDelay: "2s" }} />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 50%)`,
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Estelar KPI"
            width={40}
            height={40}
            priority
            className="rounded-lg"
          />
          <span className="text-lg font-semibold tracking-tight">Estelar KPI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-white/20 px-5 py-2 text-sm transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Iniciar sesión
          </Link>
          <Link href="/login" className="btn-gradient rounded-full px-5 py-2 text-sm font-medium">
            Acceder al sistema
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-8 pb-16 text-center lg:pt-16">
        {/* Glowing ring */}
        <div className="relative mb-10 flex h-72 w-72 items-center justify-center lg:h-80 lg:w-80">
          <div className="absolute inset-0 rounded-full border border-white/5" />
          <div
            className="absolute inset-2 rounded-full opacity-60"
            style={{
              background: `conic-gradient(from 0deg, #06b6d4, #a855f7, #ec4899, #6366f1, #06b6d4)`,
              mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
            }}
          />
          <div className="absolute inset-8 rounded-full bg-landing-bg/80 backdrop-blur-sm" />
          <div className="relative z-10 max-w-[200px] px-4">
            <h1 className="text-xl font-bold leading-tight lg:text-2xl">
              Impulse su negocio con{" "}
              <span className="gradient-text">KPIs inteligentes</span>
            </h1>
          </div>
          {/* Sparkles */}
          {SPARKLE_POSITIONS.map((pos, i) => (
            <div
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white/60"
              style={pos}
            />
          ))}
        </div>

        <p className="mb-8 max-w-2xl text-base leading-relaxed text-slate-400 lg:text-lg">
          Plataforma centralizada de indicadores comerciales y de mercadeo para{" "}
          <strong className="text-white">Hoteles Estelar</strong>. Consolide información,
          automatice cálculos y tome decisiones en tiempo real.
        </p>

        <div className="mb-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="btn-gradient inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold"
          >
            Solicitar acceso
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-3 text-sm transition-colors hover:bg-white/5"
          >
            Conocer más
          </a>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300"
            >
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* Carousel */}
      <section id="features" className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-slate-500">
          Capacidades del sistema
        </h2>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 glass-dark">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className={`flex flex-col items-center gap-6 bg-gradient-to-br ${slide.gradient} p-10 lg:flex-row lg:p-14`}
            >
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                <Icon className="h-12 w-12 text-white" />
              </div>
              <div className="text-center lg:text-left">
                <h3 className="mb-2 text-2xl font-semibold">{slide.title}</h3>
                <p className="max-w-xl text-slate-300 leading-relaxed">{slide.description}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            <button
              type="button"
              onClick={prev}
              aria-label="Anterior"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === current ? "w-8 bg-gradient-to-r from-cyan-400 to-purple-500" : "w-2 bg-white/20"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              aria-label="Siguiente"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Hoteles Estelar — Sistema de KPIs Mercadeo y Ventas
      </footer>
    </div>
  );
}

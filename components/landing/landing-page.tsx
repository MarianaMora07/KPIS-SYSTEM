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
  CheckCircle2,
  Sparkles,
  ClipboardList,
  Calculator,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { SiriWavesBackground } from "@/components/landing/siri-waves-background";

const SLIDES = [
  {
    title: "Dashboard Ejecutivo",
    description:
      "Visualice KPIs comerciales y de mercadeo en tiempo real con semáforos, tendencias y comparativos por hotel y región.",
    icon: BarChart3,
  },
  {
    title: "Metas y Cumplimiento",
    description:
      "Configure metas mensuales, trimestrales y anuales. El sistema clasifica automáticamente en cumplimiento, riesgo o incumplimiento.",
    icon: Target,
  },
  {
    title: "Integración Inteligente",
    description:
      "Conecte PMS, CRM, ERP y fuentes externas. Automatice cálculos y elimine la dependencia de archivos Excel dispersos.",
    icon: Zap,
  },
  {
    title: "Seguridad y Auditoría",
    description:
      "Control de acceso por roles, restricción geográfica por hotel/región y bitácora inmutable de cada cambio.",
    icon: Shield,
  },
];

const FEATURES = [
  "KPIs estratégicos, tácticos y operativos",
  "Semaforización automática con alertas",
  "Importación masiva Excel / CSV",
  "Análisis histórico y proyecciones",
];

const AI_CAPABILITIES = [
  {
    code: "HU-KPI-009",
    title: "Copiloto de Planes de Acción",
    description:
      "Cuando un indicador cae a rojo, el Director Comercial puede presionar «Generar Sugerencia IA» en el plan de acción. La IA recibe el KPI, valor actual, meta y hotel, y propone 3 acciones correctivas tácticas ejecutables esa misma semana.",
    icon: ClipboardList,
    badge: "Seguro",
  },
  {
    code: "HU-KPI-003",
    title: "Traductor de Fórmulas Matemáticas",
    description:
      "En la configuración de fórmulas compuestas, escriba en lenguaje natural —por ejemplo, «dividir ingresos totales entre habitaciones disponibles y multiplicar por 100»— y la IA lo convierte en la expresión matemática usando solo las variables disponibles del catálogo.",
    icon: Calculator,
    badge: "Probable",
  },
  {
    code: "HU-KPI-007",
    title: "Analista de Tendencias",
    description:
      "Desde el Dashboard Ejecutivo, genere un «Resumen Ejecutivo Narrado» con un clic. La IA analiza los últimos 6 meses del KPI activo, resume la tendencia, identifica el mes más crítico y señala si la proyección requiere atención inmediata.",
    icon: TrendingUp,
    badge: "Seguro",
  },
  {
    code: "HU-KPI-004",
    title: "Mapeo Inteligente de Columnas",
    description:
      "Al importar Excel, si los encabezados no coinciden exactamente con el catálogo (p. ej. «Rev_Par_Mayo_Final»), la IA intenta emparejarlos automáticamente con los códigos de KPI antes de rechazar el archivo.",
    icon: FileSpreadsheet,
    badge: "Probable",
  },
];

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
    <div className="min-h-screen bg-white text-imperial-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 w-full border-b-2 border-imperial-900/10 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <Image
              src="/logo_estelar.png"
              alt="Estelar KPI"
              width={40}
              height={40}
              priority
              className="rounded-full object-contain ring-2 ring-imperial-900/15"
            />
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-bold leading-tight text-imperial-900">
                Hoteles Estelar
              </p>
              <p className="truncate text-xs font-medium text-imperial-700/80">
                Sistema de KPIs
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg border-2 border-imperial-900/20 px-4 py-2 text-sm font-semibold text-imperial-900 transition-colors hover:border-imperial-900 hover:bg-imperial-900/5 sm:inline-block"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/login"
              className="btn-primary whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Acceder
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f0f4fa] to-slate-50">
        <SiriWavesBackground />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 text-center lg:py-28">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-block rounded-full border border-imperial-900/20 bg-imperial-900/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-imperial-900"
          >
            Mercadeo y ventas
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-3xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl"
          >
            <span className="text-imperial-900">Impulse su negocio con </span>
            <span className="text-imperial-900 underline decoration-imperial-900/25 decoration-4 underline-offset-4">
              KPIs inteligentes
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 lg:text-lg"
          >
            Plataforma centralizada de indicadores comerciales y de mercadeo para{" "}
            <strong className="font-bold text-imperial-900">
              Hoteles Estelar
            </strong>
            . Consolide información, automatice cálculos y tome decisiones en
            tiempo real.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Link
              href="/login"
              className="btn-primary inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-sm font-bold uppercase tracking-wide shadow-lg shadow-imperial-900/25"
            >
              Solicitar acceso
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#capacidades"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-imperial-900 bg-white/80 px-8 py-3.5 text-sm font-bold text-imperial-900 backdrop-blur-sm transition-colors hover:bg-imperial-900 hover:text-white"
            >
              Conocer más
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="rounded-xl border border-slate-200 border-l-4 border-l-imperial-900 bg-white p-5 shadow-sm transition-shadow hover:border-imperial-700/30 hover:shadow-md hover:shadow-imperial-900/5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-imperial-900/10">
                <CheckCircle2 className="h-5 w-5 text-imperial-900" />
              </div>
              <p className="text-sm font-medium leading-snug text-slate-700">
                {feature}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Capacidades de IA */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 py-14 lg:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-imperial-900">
              <Sparkles className="h-4 w-4" />
              Inteligencia artificial
            </p>
            <h2 className="mt-2 text-2xl font-bold text-imperial-900 sm:text-3xl">
              Cuatro asistentes IA para decidir más rápido
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Funciones integradas que reducen fricción operativa: desde planes de
              acción en crisis hasta importación de Excel con columnas no estándar.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {AI_CAPABILITIES.map((cap, i) => {
              const CapIcon = cap.icon;
              const isSecure = cap.badge === "Seguro";
              return (
                <motion.article
                  key={cap.code}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -3 }}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:border-imperial-700/25 hover:shadow-md hover:shadow-imperial-900/5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-imperial-900/10">
                      <CapIcon className="h-5 w-5 text-imperial-900" />
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        isSecure
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      }`}
                    >
                      {cap.badge}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {cap.code}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-imperial-900">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {cap.description}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ofertas / capacidades carousel */}
      <section id="capacidades" className="border-t-4 border-imperial-900/10 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-imperial-900">
              Capacidades del sistema
            </p>
            <h2 className="mt-2 text-2xl font-bold text-imperial-900 sm:text-3xl">
              Todo lo que necesita para gestionar sus indicadores
            </h2>
          </div>

          <div className="relative overflow-hidden rounded-2xl border-2 border-imperial-900/15 bg-white shadow-lg shadow-imperial-900/5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -48 }}
                transition={{ duration: 0.35 }}
                className="flex flex-row items-start gap-6 p-8 sm:items-center sm:gap-8 sm:p-10 lg:p-14"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-imperial-900 shadow-md sm:h-24 sm:w-24">
                  <Icon className="h-10 w-10 text-white sm:h-12 sm:w-12" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h3 className="mb-3 text-2xl font-bold text-imperial-900">
                    {slide.title}
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-slate-600">
                    {slide.description}
                  </p>
                  <Link
                    href="/login"
                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-imperial-900 hover:underline"
                  >
                    Ver más
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={prev}
                aria-label="Anterior"
                className="justify-self-start rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-imperial-700/30 hover:text-imperial-900"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex justify-center gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === current
                        ? "w-8 bg-imperial-900"
                        : "w-2 bg-slate-300 hover:bg-slate-400"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={next}
                aria-label="Siguiente"
                className="justify-self-end rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-imperial-700/30 hover:text-imperial-900"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mini cards row — preview of all slides */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SLIDES.map((s, i) => {
              const SlideIcon = s.icon;
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    i === current
                      ? "border-imperial-900 bg-imperial-900 text-white shadow-md"
                      : "border-slate-200 bg-white text-slate-700 hover:border-imperial-700/30 hover:shadow-sm"
                  }`}
                >
                  <SlideIcon
                    className={`mb-2 h-5 w-5 ${i === current ? "text-white" : "text-imperial-900"}`}
                  />
                  <p className="text-sm font-semibold">{s.title}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-imperial-900 py-14 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">
            El placer de descubrir sus indicadores
          </h2>
          <p className="mt-4 text-sm text-white/75 sm:text-base">
            Acceda al sistema de KPIs de Hoteles Estelar y transforme datos en
            decisiones estratégicas.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-sm font-bold uppercase tracking-wide text-imperial-900 transition-colors hover:bg-slate-100"
          >
            Acceder al sistema
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Hoteles Estelar — Sistema de KPIs Mercadeo
        y Ventas
      </footer>
    </div>
  );
}

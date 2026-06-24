"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { FormModal } from "@/components/ui/form-modal";

export type KpiDetailTab = "seguimiento" | "metas";

interface KpiDetailFlowGuideProps {
  tab: KpiDetailTab;
  kpiCodigo: string;
}

const GUIDE_CONFIG: Record<
  KpiDetailTab,
  { title: string; subtitle: string; buttonLabel: string }
> = {
  seguimiento: {
    title: "Seguimiento operativo",
    subtitle: "Cómo registrar mediciones y alcances del indicador",
    buttonLabel: "Guía de seguimiento",
  },
  metas: {
    title: "Metas y cumplimiento",
    subtitle: "Cómo definir objetivos, alcances y semáforo",
    buttonLabel: "Guía de metas",
  },
};

export function KpiDetailFlowGuide({ tab, kpiCodigo }: KpiDetailFlowGuideProps) {
  const [open, setOpen] = useState(false);
  const config = GUIDE_CONFIG[tab];

  useEffect(() => {
    setOpen(false);
  }, [tab]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-imperial-700/30 hover:bg-slate-50 hover:text-imperial-900"
        aria-label={config.buttonLabel}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        {config.buttonLabel}
      </button>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={config.title}
        subtitle={config.subtitle}
        maxWidth="md"
      >
        {tab === "seguimiento" ? (
          <SeguimientoGuideContent kpiCodigo={kpiCodigo} />
        ) : (
          <MetasGuideContent kpiCodigo={kpiCodigo} />
        )}
      </FormModal>
    </>
  );
}

function SeguimientoGuideContent({ kpiCodigo }: { kpiCodigo: string }) {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <p>
        Registre las <strong>mediciones reales</strong> del indicador{" "}
        <span className="font-mono text-xs text-amber-700">{kpiCodigo}</span>. Cada registro es
        un avance con fecha y, si aplica, alcance (hotel, región, campaña u otro desglose).
      </p>
      <ul className="list-inside list-disc space-y-2">
        <li>
          <strong>Valor global:</strong> deje vacías las dimensiones al registrar (sin hotel ni
          región).
        </li>
        <li>
          <strong>Valor por hotel:</strong> seleccione el hotel al registrar; alimenta metas con el
          mismo alcance.
        </li>
        <li>
          El <strong>cumplimiento</strong> y el <strong>semáforo</strong> se calculan cruzando cada
          avance con la meta del periodo que coincida (fecha + alcance).
        </li>
        <li>
          Los gráficos y la tabla de valores muestran el historial. El dashboard en la pestaña{" "}
          <strong>Resumen</strong> usa el último valor disponible.
        </li>
      </ul>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Las metas por periodo se configuran en la pestaña <strong>Metas y semáforo</strong>. El
        dashboard de metas cruza meta + avance registrado aquí para calcular cumplimiento y
        semáforo.
      </p>
    </div>
  );
}

function MetasGuideContent({ kpiCodigo }: { kpiCodigo: string }) {
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <p>
        Defina <strong>objetivos por periodo</strong> para{" "}
        <span className="font-mono text-xs text-amber-700">{kpiCodigo}</span>. Una meta guarda la
        cifra comprometida, el rango de fechas y el alcance organizacional.
      </p>
      <ul className="list-inside list-disc space-y-2">
        <li>
          <strong>Meta global:</strong> sin hotel, región ni campaña — aplica a toda la
          organización.
        </li>
        <li>
          <strong>Meta por hotel o región:</strong> seleccione el alcance al crear la meta; solo se
          comparará con avances del mismo alcance.
        </li>
        <li>
          <strong>Avance inicial (opcional):</strong> al crear la meta puede registrar el primer
          avance; si no, hágalo en <strong>Seguimiento → Registrar valor</strong>.
        </li>
        <li>
          <strong>Semáforo:</strong> configure los rangos de cumplimiento (%); el color se calcula
          al cruzar meta vs avance en el periodo.
        </li>
      </ul>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Consulte el cumplimiento consolidado en{" "}
        <Link
          href="/dashboard?tab=cumplimiento"
          className="font-medium text-imperial-900 underline hover:text-amber-800"
        >
          Dashboard → Cumplimiento
        </Link>
        . La pestaña Resumen muestra el desempeño general sin detalle por meta.
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { duplicateKpiAction } from "@/modules/kpis/actions/kpi-actions";
import { TargetsPanel } from "@/modules/metas/components/targets-panel";
import { TrafficLightPanel } from "@/modules/metas/components/traffic-light-panel";
import { FormulaPanel } from "@/modules/formulas/components/formula-panel";

interface KpiDetailViewProps {
  kpi: Record<string, unknown>;
  versions: { version: number; created_at: string }[];
  values: { fecha: string; valor_real: number; cumplimiento_pct: number | null }[];
  targets: Record<string, unknown>[];
}

export function KpiDetailView({
  kpi,
  versions,
  values,
  targets,
}: KpiDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const id = kpi.id as string;

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const copy = await duplicateKpiAction(id);
        setShowDuplicateConfirm(false);
        if (copy?.id) router.push(`/kpis/${copy.id}`);
      } catch (err) {
        setShowDuplicateConfirm(false);
        setErrorMsg(err instanceof Error ? err.message : "Error al duplicar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/kpis"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-imperial-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a KPIs
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/kpis/${id}/editar`}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowDuplicateConfirm(true)}
            className="flex items-center gap-1 rounded-lg bg-imperial-900 px-3 py-1.5 text-sm text-white"
          >
            <Copy className="h-4 w-4" />
            Duplicar
          </button>
        </div>
      </div>

      <div className="glass rounded-xl border border-slate-200/60 p-6">
        <p className="font-mono text-xs text-amber-600">{kpi.codigo as string}</p>
        <h1 className="text-2xl font-semibold text-imperial-900">{kpi.nombre as string}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {kpi.area_responsable as string} · {kpi.frecuencia as string} · v
          {kpi.version_actual as number}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TargetsPanel kpiId={id} targets={targets} />
        <TrafficLightPanel kpiId={id} />
      </div>

      <FormulaPanel kpiId={id} kpiNombre={kpi.nombre as string} />

      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Últimos valores
        </h2>
        <ul className="space-y-2 text-sm">
          {values.map((v, i) => (
            <li key={i} className="flex justify-between rounded bg-slate-50 px-3 py-2">
              <span>{v.fecha}</span>
              <span className="font-medium">{v.valor_real}</span>
              <span className="text-slate-500">{v.cumplimiento_pct ?? "—"}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Historial de versiones
        </h2>
        <ul className="space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.version} className="rounded bg-slate-50 px-3 py-2">
              v{v.version} — {new Date(v.created_at).toLocaleString("es-CO")}
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={showDuplicateConfirm}
        title="Duplicar KPI"
        description={`Se creará una copia de ${kpi.codigo as string} con metas asociadas. ¿Desea continuar?`}
        confirmLabel="Duplicar"
        cancelLabel="Cancelar"
        variant="default"
        loading={pending}
        onConfirm={handleDuplicate}
        onCancel={() => setShowDuplicateConfirm(false)}
      />

      <ConfirmDialog
        open={!!errorMsg}
        title="No se pudo duplicar"
        description={errorMsg ?? undefined}
        confirmLabel="Entendido"
        variant="danger"
        showCancel={false}
        onConfirm={() => setErrorMsg(null)}
        onCancel={() => setErrorMsg(null)}
      />
    </div>
  );
}

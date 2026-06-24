"use client";

import type { DimensionCatalogs } from "@/lib/kpis/dimension-scope";
import {
  formatTargetPeriodLabel,
  formatTargetScopeLabel,
  type TargetRowForMatch,
} from "@/lib/metas/match-value-to-targets";

interface RegisterValueTargetPreviewProps {
  fecha: string;
  matches: TargetRowForMatch[];
  nonMatches: TargetRowForMatch[];
  loading?: boolean;
  catalogs?: DimensionCatalogs;
}

export function RegisterValueTargetPreview({
  fecha,
  matches,
  nonMatches,
  loading = false,
  catalogs = {},
}: RegisterValueTargetPreviewProps) {
  if (!fecha) return null;

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
        Verificando metas para el {fecha}…
      </div>
    );
  }

  if (matches.length === 0 && nonMatches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
        Este KPI aún no tiene metas configuradas. El valor quedará registrado sin cumplimiento por
        meta.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {matches.length > 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50/80 px-3 py-2.5">
          <p className="text-xs font-medium text-green-900">
            Con fecha {fecha}, este valor alimentará {matches.length} meta
            {matches.length !== 1 ? "s" : ""}:
          </p>
          <ul className="mt-2 space-y-1.5">
            {matches.map((t) => (
              <TargetMatchRow key={t.id} target={t} catalogs={catalogs} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-950">
            Ninguna meta coincide con {fecha} y el alcance seleccionado.
          </p>
          <p className="mt-1 text-xs text-amber-900/85">
            Ajuste la fecha o el desglose, o confirme si desea registrar el valor igualmente.
          </p>
        </div>
      )}

      {nonMatches.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-600">
            {matches.length > 0 ? "Otras metas (no aplican)" : "Metas existentes en este KPI"}:
          </p>
          <ul className="mt-2 space-y-1.5">
            {nonMatches.map((t) => (
              <TargetMatchRow key={t.id} target={t} catalogs={catalogs} muted />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TargetMatchRow({
  target,
  catalogs,
  muted = false,
}: {
  target: TargetRowForMatch;
  catalogs: DimensionCatalogs;
  muted?: boolean;
}) {
  const scope = formatTargetScopeLabel(target, catalogs);
  const periodo = formatTargetPeriodLabel(target.periodo_tipo);

  return (
    <li
      className={`flex flex-wrap items-center gap-2 text-xs ${
        muted ? "text-slate-500" : "text-green-900"
      }`}
    >
      <span
        className={`rounded-full px-2 py-0.5 font-medium ring-1 ${
          muted
            ? "bg-white text-slate-600 ring-slate-200"
            : "bg-white text-green-800 ring-green-200"
        }`}
      >
        {scope}
      </span>
      <span>
        {periodo}: {target.fecha_inicio} — {target.fecha_fin} · meta {target.valor_meta}
      </span>
    </li>
  );
}

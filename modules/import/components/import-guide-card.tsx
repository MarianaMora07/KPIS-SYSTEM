import { FileSpreadsheet, Info, Layers, Variable } from "lucide-react";

export function ImportGuideCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white shadow-sm">
      <div className="border-b border-slate-200/80 bg-imperial-900 px-5 py-3">
        <div className="flex items-center gap-2 text-white">
          <FileSpreadsheet className="h-4 w-4 text-amber-300" aria-hidden />
          <h2 className="text-sm font-semibold">Carga masiva de valores KPI</h2>
        </div>
        <p className="mt-1 text-xs text-white/75">
          Importe mediciones a indicadores ya creados en el sistema.
        </p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-imperial-900">
            <Info className="h-4 w-4 text-indigo-600" aria-hidden />
            <p className="text-sm font-medium">Columnas base</p>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li>
              <code className="rounded bg-slate-100 px-1 py-0.5">kpi_codigo</code> — código del
              indicador
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 py-0.5">fecha</code> — formato{" "}
              <span className="font-mono">AAAA-MM-DD</span>
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1 py-0.5">hotel_codigo</code> — opcional,
              para desglose por hotel
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-imperial-900">
            <Layers className="h-4 w-4 text-emerald-600" aria-hidden />
            <p className="text-sm font-medium">KPI sin fórmula</p>
          </div>
          <p className="text-xs text-slate-600">
            Complete la columna{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">valor_real</code> con el número
            medido. No requiere columnas de variables.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-imperial-900">
            <Variable className="h-4 w-4 text-violet-600" aria-hidden />
            <p className="text-sm font-medium">KPI con fórmula</p>
          </div>
          <p className="text-xs text-slate-600">
            Use columnas <code className="rounded bg-slate-100 px-1 py-0.5">var_&#123;codigo&#125;</code>{" "}
            por cada variable (ej.{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">var_visitas_mes</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">var_reservas_web</code>). Deje{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">valor_real</code> vacío; el sistema
            calcula el resultado.
          </p>
        </div>
      </div>

      <p className="border-t border-slate-200/80 bg-slate-50/80 px-5 py-3 text-xs text-slate-500">
        Las variables y fórmulas se definen en el detalle de cada KPI. Solo el administrador puede
        gestionarlas. Descargue la plantilla Excel para ver ejemplos listos para usar.
      </p>
    </div>
  );
}

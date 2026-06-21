"use client";

import { FunctionSquare } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { KpiCreateForm } from "@/modules/kpis/components/kpi-create-form";
import { RegisterValueForm } from "@/modules/kpis/components/register-value-form";
import type { KpiFormCatalogs } from "@/modules/kpis/components/kpi-form-fields";
import type { FormulaVariableRow } from "@/modules/kpis/components/kpi-create-formula-step";

interface KpisPageToolbarProps extends KpiFormCatalogs {
  kpis: { id: string; codigo: string; nombre: string }[];
  variables?: FormulaVariableRow[];
  activeTab?: "indicadores" | "variables";
  onOpenVariables?: () => void;
}

export function KpisPageToolbar({
  kpis,
  variables = [],
  activeTab = "indicadores",
  onOpenVariables,
  ...catalogs
}: KpisPageToolbarProps) {
  const { can } = usePermissions();
  const showCreate = can("kpis.crear");
  const showRegister = can("metas.configurar");

  if (!showCreate && !showRegister && !onOpenVariables) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {showCreate && <KpiCreateForm variables={variables} {...catalogs} />}
      {showRegister && <RegisterValueForm kpis={kpis} />}
      {onOpenVariables && (
        <button
          type="button"
          onClick={onOpenVariables}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "variables"
              ? "border border-amber-400 bg-amber-50 text-imperial-900"
              : "border border-slate-200 bg-white text-imperial-900 hover:border-imperial-700/30 hover:bg-slate-50"
          }`}
        >
          <FunctionSquare className="h-4 w-4" />
          Variables
        </button>
      )}
    </div>
  );
}

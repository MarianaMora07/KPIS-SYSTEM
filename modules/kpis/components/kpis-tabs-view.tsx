"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { KpiList } from "@/modules/kpis/components/kpi-list";
import { KpisPageToolbar } from "@/modules/kpis/components/kpis-page-toolbar";
import { VariablesCatalogView } from "@/modules/formulas/components/variables-catalog-view";
import type { KpiFormCatalogs } from "@/modules/kpis/components/kpi-form-fields";

type KpiTab = "indicadores" | "variables";

interface VariableRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  unidad_medida?: string | null;
  formula_compuesta?: string | null;
}

interface KpiListRow {
  id: string;
  codigo: string;
  nombre: string;
  area_responsable: string;
  frecuencia: string;
  unidad_medida: string;
  meta: number | null;
  tipo_indicador: string;
  estado: string;
  kpi_categories: { nombre: string } | null;
}

interface KpisTabsViewProps extends KpiFormCatalogs {
  kpis: KpiListRow[];
  variables: VariableRow[];
  initialTab?: KpiTab;
}

export function KpisTabsView({
  kpis,
  variables,
  initialTab = "indicadores",
  ...catalogs
}: KpisTabsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<KpiTab>(initialTab);

  const setTabWithUrl = useCallback(
    (next: KpiTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "variables") {
        params.set("tab", "variables");
      } else {
        params.delete("tab");
      }
      const qs = params.toString();
      router.replace(qs ? `/kpis?${qs}` : "/kpis", { scroll: false });
    },
    [router, searchParams]
  );

  function toggleVariables() {
    setTabWithUrl(tab === "variables" ? "indicadores" : "variables");
  }

  return (
    <div className="space-y-6">
      <KpisPageToolbar
        kpis={kpis.map((k) => ({
          id: k.id,
          codigo: k.codigo,
          nombre: k.nombre,
        }))}
        variables={variables}
        activeTab={tab}
        onOpenVariables={toggleVariables}
        {...catalogs}
      />

      {tab === "indicadores" ? (
        <KpiList kpis={kpis} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setTabWithUrl("indicadores")}
            className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-imperial-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a indicadores
          </button>
          <VariablesCatalogView variables={variables} />
        </>
      )}
    </div>
  );
}

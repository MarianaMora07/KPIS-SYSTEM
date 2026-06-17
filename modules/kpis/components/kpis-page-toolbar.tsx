"use client";

import { usePermissions } from "@/components/layout/permissions-context";
import { KpiCreateForm } from "@/modules/kpis/components/kpi-create-form";
import { RegisterValueForm } from "@/modules/kpis/components/register-value-form";
import type { KpiFormCatalogs } from "@/modules/kpis/components/kpi-form-fields";

interface KpisPageToolbarProps extends KpiFormCatalogs {
  kpis: { id: string; codigo: string; nombre: string }[];
}

export function KpisPageToolbar({ kpis, ...catalogs }: KpisPageToolbarProps) {
  const { can } = usePermissions();
  const showCreate = can("kpis.crear");
  const showRegister = can("metas.configurar");

  if (!showCreate && !showRegister) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showCreate && <KpiCreateForm {...catalogs} />}
      {showRegister && <RegisterValueForm kpis={kpis} />}
    </div>
  );
}

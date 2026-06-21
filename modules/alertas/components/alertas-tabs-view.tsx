"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { FormModal } from "@/components/ui/form-modal";
import { AlertsList } from "./alerts-list";
import { ActionPlanForm } from "./action-plan-form";
import { ActionPlansPanel, type ActionPlanRow } from "./action-plans-panel";
import type { AlertRow } from "../types";

export interface PlanFormParams {
  kpiId: string;
  kpiNombre: string;
  hotelNombre?: string;
  alertId?: string;
  severidad?: AlertRow["severidad"];
}

interface AlertasTabsViewProps {
  alerts: AlertRow[];
  plans: ActionPlanRow[];
  users?: { id: string; nombre: string }[];
  isDemo?: boolean;
  planFormParams?: PlanFormParams | null;
  initialTab?: "alertas" | "planes";
}

export function AlertasTabsView({
  alerts,
  plans,
  users = [],
  isDemo,
  planFormParams,
  initialTab = "alertas",
}: AlertasTabsViewProps) {
  const { can } = usePermissions();
  const canManagePlans = can("planes.gestionar");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"alertas" | "planes">(
    initialTab === "planes" && canManagePlans ? "planes" : "alertas"
  );
  const [planModal, setPlanModal] = useState<PlanFormParams | null>(planFormParams ?? null);

  useEffect(() => {
    if (planFormParams) setPlanModal(planFormParams);
  }, [planFormParams]);

  function closePlanModal(refresh = false) {
    setPlanModal(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("accion");
    params.delete("kpi_id");
    params.delete("kpi");
    params.delete("alert_id");
    params.delete("hotel_id");
    params.delete("hotel");
    const qs = params.toString();
    router.replace(qs ? `/alertas?${qs}` : "/alertas", { scroll: false });
    if (refresh) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "alertas"} onClick={() => setTab("alertas")}>
          Alertas abiertas ({alerts.length})
        </TabButton>
        {canManagePlans && (
          <TabButton active={tab === "planes"} onClick={() => setTab("planes")}>
            Planes de acción ({plans.length})
          </TabButton>
        )}
      </div>

      {tab === "alertas" || !canManagePlans ? (
        <AlertsList
          alerts={alerts}
          isDemo={isDemo}
          onOpenPlan={canManagePlans ? (params) => setPlanModal(params) : undefined}
        />
      ) : (
        <ActionPlansPanel plans={plans} />
      )}

      {planModal && canManagePlans && (
        <FormModal
          open
          onClose={closePlanModal}
          title="Registrar plan de acción"
          subtitle={
            planModal.hotelNombre
              ? `${planModal.kpiNombre} · ${planModal.hotelNombre}`
              : planModal.kpiNombre
          }
          maxWidth="lg"
        >
          {isDemo ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Configure Supabase e inicie sesión para persistir planes.
              <Link href="/login" className="ml-1 underline">
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <ActionPlanForm
              kpiId={planModal.kpiId}
              kpiNombre={planModal.kpiNombre}
              hotelNombre={planModal.hotelNombre}
              alertId={planModal.alertId}
              severidad={planModal.severidad}
              users={users}
              onSuccess={() => closePlanModal(true)}
              onCancel={() => closePlanModal()}
            />
          )}
        </FormModal>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-amber-500 text-imperial-900"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

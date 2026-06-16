"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { AlertsList } from "./alerts-list";
import { ActionPlanForm } from "./action-plan-form";
import { ActionPlansPanel, type ActionPlanRow } from "./action-plans-panel";
import type { AlertRow } from "../types";

interface AlertasTabsViewProps {
  alerts: AlertRow[];
  plans: ActionPlanRow[];
  users?: { id: string; nombre: string }[];
  isDemo?: boolean;
  planFormParams?: {
    kpiId: string;
    kpiNombre: string;
    hotelNombre?: string;
    alertId?: string;
  } | null;
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
  const [tab, setTab] = useState<"alertas" | "planes">(initialTab);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "alertas"} onClick={() => setTab("alertas")}>
          Alertas activas ({alerts.length})
        </TabButton>
        <TabButton active={tab === "planes"} onClick={() => setTab("planes")}>
          Planes de acción ({plans.length})
        </TabButton>
      </div>

      {planFormParams && (
        <div className="glass rounded-xl border border-amber-200/60 bg-amber-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-imperial-900">
              Registrar plan de acción
            </h2>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            KPI: <strong>{planFormParams.kpiNombre}</strong>
            {planFormParams.hotelNombre && (
              <>
                {" "}
                · Hotel: <strong>{planFormParams.hotelNombre}</strong>
              </>
            )}
          </p>
          {isDemo ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Configure Supabase e inicie sesión para persistir planes.
              <Link href="/login" className="ml-1 underline">
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <ActionPlanForm
              kpiId={planFormParams.kpiId}
              kpiNombre={planFormParams.kpiNombre}
              hotelNombre={planFormParams.hotelNombre}
              alertId={planFormParams.alertId}
              users={users}
            />
          )}
        </div>
      )}

      {tab === "alertas" ? (
        <AlertsList alerts={alerts} isDemo={isDemo} />
      ) : (
        <ActionPlansPanel plans={plans} />
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

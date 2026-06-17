"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { MetasDashboardPanel } from "@/modules/metas/components/metas-dashboard-panel";
import type { DashboardKpiRow } from "@/modules/dashboard/types";
import type { MetasDashboardRow } from "@/modules/metas/types";

export type DashboardTab = "ejecutivo" | "metas";

interface DashboardTabsViewProps {
  kpiCards: DashboardKpiRow[];
  worstPerformers: DashboardKpiRow[];
  history: DashboardKpiRow[];
  metas: MetasDashboardRow[];
  isDemo?: boolean;
  initialTab?: DashboardTab;
}

export function DashboardTabsView({
  kpiCards,
  worstPerformers,
  history,
  metas,
  isDemo,
  initialTab = "ejecutivo",
}: DashboardTabsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DashboardTab>(initialTab);

  const setTabWithUrl = useCallback(
    (next: DashboardTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "metas") {
        params.set("tab", "metas");
      } else {
        params.delete("tab");
      }
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "ejecutivo"} onClick={() => setTabWithUrl("ejecutivo")}>
          Ejecutivo
        </TabButton>
        <TabButton active={tab === "metas"} onClick={() => setTabWithUrl("metas")}>
          Metas ({metas.length})
        </TabButton>
      </div>

      {tab === "ejecutivo" ? (
        <DashboardView
          kpiCards={kpiCards}
          worstPerformers={worstPerformers}
          history={history}
          isDemo={isDemo}
        />
      ) : (
        <MetasDashboardPanel rows={metas} />
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
          ? "border-imperial-900 text-imperial-900"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

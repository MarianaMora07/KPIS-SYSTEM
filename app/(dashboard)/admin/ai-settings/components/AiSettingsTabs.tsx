"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings2, BarChart3 } from "lucide-react";
import type { AiConfigurationRow, AiProvider, AiUsageMetrics } from "../actions/ai-settings-actions";
import { AiConfigurationsTab } from "./AiConfigurationsTab";
import { AiUsageMetricsTab } from "./AiUsageMetricsTab";

const TABS = [
  { id: "config", label: "Configuraciones", icon: Settings2 },
  { id: "metrics", label: "Métricas de Uso", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AiSettingsTabsProps {
  configurations: AiConfigurationRow[];
  providers: AiProvider[];
  metrics: AiUsageMetrics;
}

export function AiSettingsTabs({
  configurations,
  providers,
  metrics,
}: AiSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("config");

  return (
    <div className="space-y-6">
      {/* Tab list */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                isActive
                  ? "text-imperial-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {activeTab === "config" && (
        <AiConfigurationsTab
          initialConfigurations={configurations}
          providers={providers}
        />
      )}
      {activeTab === "metrics" && <AiUsageMetricsTab metrics={metrics} />}
    </div>
  );
}

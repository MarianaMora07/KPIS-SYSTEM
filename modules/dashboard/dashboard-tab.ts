export type DashboardTab = "resumen" | "cumplimiento";

/** Acepta URLs legacy (`ejecutivo`, `metas`) y las nuevas (`resumen`, `cumplimiento`). */
export function parseDashboardTab(tab?: string | null): DashboardTab {
  if (tab === "cumplimiento" || tab === "metas") return "cumplimiento";
  return "resumen";
}

export {
  getLatestKpiCards,
  getDashboardKpis,
  getKpiHistory,
  getCriticalKpis,
  getWorstPerformers,
} from "./services/dashboard-service";
export type { DashboardFilters } from "./types";
export { DashboardView } from "./components/dashboard-view";
export { DEMO_DASHBOARD_DATA, DEMO_REGIONS, DEMO_HOTELS } from "./data/demo-data";

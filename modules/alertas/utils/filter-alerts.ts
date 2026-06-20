import type { AlertRow } from "../types";
import type { AlertListFilters } from "../services/alert-service";

export function filterAlertsClient(
  alerts: AlertRow[],
  filters: AlertListFilters
): AlertRow[] {
  return alerts.filter((a) => {
    if (filters.hotelId && a.hotel_id !== filters.hotelId) return false;
    if (filters.regionId && a.region_id !== filters.regionId) return false;
    if (filters.fechaDesde) {
      const desde = new Date(filters.fechaDesde).getTime();
      if (new Date(a.created_at).getTime() < desde) return false;
    }
    if (filters.fechaHasta) {
      const hasta = new Date(`${filters.fechaHasta}T23:59:59.999Z`).getTime();
      if (new Date(a.created_at).getTime() > hasta) return false;
    }
    return true;
  });
}

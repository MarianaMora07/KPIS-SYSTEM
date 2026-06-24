export const REPORT_PERIODS = [
  { id: "2026-06", label: "Jun 2026", desde: "2026-06-01", hasta: "2026-06-30" },
  { id: "2026-05", label: "May 2026", desde: "2026-05-01", hasta: "2026-05-31" },
  { id: "2026-q2", label: "Q2 2026", desde: "2026-04-01", hasta: "2026-06-30" },
  { id: "2026", label: "2026", desde: "2026-01-01", hasta: "2026-12-31" },
] as const;

export interface ReportFilterCatalogItem {
  id: string;
  nombre: string;
}

export interface ReportFilterLabels {
  periodo: string;
  region: string;
  hotel: string;
}

export function resolveReportFilterLabels(
  params: {
    periodo?: string | null;
    region?: string | null;
    hotel?: string | null;
  },
  catalogs: {
    regions?: ReportFilterCatalogItem[];
    hotels?: ReportFilterCatalogItem[];
  } = {}
): ReportFilterLabels {
  const period = REPORT_PERIODS.find((item) => item.id === params.periodo);
  const periodo = period?.label ?? params.periodo?.trim() ?? "Sin período";

  const regionId = params.region?.trim() ?? "";
  const hotelId = params.hotel?.trim() ?? "";

  const region = regionId
    ? catalogs.regions?.find((item) => item.id === regionId)?.nombre ?? regionId
    : "Todas";

  const hotel = hotelId
    ? catalogs.hotels?.find((item) => item.id === hotelId)?.nombre ?? hotelId
    : "Todos";

  return { periodo, region, hotel };
}

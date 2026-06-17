"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, Suspense } from "react";
import { ExportReportButton } from "@/modules/dashboard/components/export-report-button";

interface FilterOption {
  id: string;
  nombre: string;
  region_id?: string;
}

interface HeaderFiltersProps {
  regions: FilterOption[];
  hotels: FilterOption[];
}

const PERIODS = [
  { id: "2026-06", label: "Jun 2026", desde: "2026-06-01", hasta: "2026-06-30" },
  { id: "2026-05", label: "May 2026", desde: "2026-05-01", hasta: "2026-05-31" },
  { id: "2026-q2", label: "Q2 2026", desde: "2026-04-01", hasta: "2026-06-30" },
  { id: "2026", label: "2026", desde: "2026-01-01", hasta: "2026-12-31" },
];

export function HeaderFilters({ regions, hotels }: HeaderFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showExport = pathname === "/dashboard" || pathname === "/reportes";

  const regionFilter = searchParams.get("region") ?? "";
  const filteredHotels = regionFilter
    ? hotels.filter((h) => h.region_id === regionFilter)
    : hotels;

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      if (key === "region") params.delete("hotel");
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const onPeriodChange = (periodId: string) => {
    const period = PERIODS.find((p) => p.id === periodId);
    const params = new URLSearchParams(searchParams.toString());
    if (period) {
      params.set("periodo", period.id);
      params.set("desde", period.desde);
      params.set("hasta", period.hasta);
    } else {
      params.delete("periodo");
      params.delete("desde");
      params.delete("hasta");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
      <FilterSelect
        label="Región"
        value={searchParams.get("region") ?? ""}
        onChange={(v) => updateFilter("region", v)}
        options={[{ id: "", nombre: "Todas" }, ...regions]}
      />
      <FilterSelect
        label="Hotel"
        value={searchParams.get("hotel") ?? ""}
        onChange={(v) => updateFilter("hotel", v)}
        options={[{ id: "", nombre: "Todos" }, ...filteredHotels]}
      />
      <FilterSelect
        label="Período"
        value={searchParams.get("periodo") ?? "2026-06"}
        onChange={onPeriodChange}
        options={PERIODS.map((p) => ({ id: p.id, nombre: p.label }))}
      />
      {showExport && (
        <Suspense fallback={null}>
          <ExportReportButton />
        </Suspense>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; nombre: string }[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-slate-200 bg-white/90 py-2 pl-3 pr-8 text-sm text-imperial-900 backdrop-blur-sm transition-colors hover:border-imperial-700/30 focus:border-imperial-900 focus:outline-none focus:ring-2 focus:ring-imperial-900/15"
      >
        {options.map((opt) => (
          <option key={opt.id || "all"} value={opt.id}>
            {label}: {opt.nombre}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

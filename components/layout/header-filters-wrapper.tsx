"use client";

import { Suspense } from "react";
import { HeaderFilters } from "./header-filters";

interface FilterOption {
  id: string;
  nombre: string;
  region_id?: string;
}

interface HeaderFiltersWrapperProps {
  regions: FilterOption[];
  hotels: FilterOption[];
}

export function HeaderFiltersWrapper({
  regions,
  hotels,
}: HeaderFiltersWrapperProps) {
  return (
    <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />}>
      <HeaderFilters regions={regions} hotels={hotels} />
    </Suspense>
  );
}

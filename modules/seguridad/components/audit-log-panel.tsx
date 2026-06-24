"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { AuditLogRow } from "../types";
import { computeAuditStats } from "../lib/audit-stats";
import { AuditStatsCards } from "./audit-stats-cards";
import { AuditLogTable } from "./audit-log-table";
import { AuditFilterCombobox } from "./audit-filter-combobox";
import { filterAuditLogsAction } from "../actions/security-actions";

const PAGE_SIZE = 10;
const FILTER_DEBOUNCE_MS = 350;

interface AuditFilterSuggestions {
  emails: string[];
  entidades: string[];
}

interface AuditLogPanelProps {
  initialLogs: AuditLogRow[];
  namesMap: Record<string, string>;
  filterSuggestions?: AuditFilterSuggestions;
  showHuFooter?: boolean;
}

function hasActiveFilters(filters: {
  entidad: string;
  usuarioEmail: string;
  fechaDesde: string;
  fechaHasta: string;
}) {
  return Boolean(
    filters.entidad ||
      filters.usuarioEmail ||
      filters.fechaDesde ||
      filters.fechaHasta
  );
}

export function AuditLogPanel({
  initialLogs,
  namesMap,
  filterSuggestions,
  showHuFooter = false,
}: AuditLogPanelProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [page, setPage] = useState(0);
  const [entidad, setEntidad] = useState("");
  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pending, startTransition] = useTransition();
  const skipAutoFilter = useRef(true);

  const emailSuggestions = useMemo(() => {
    const emails = new Set(filterSuggestions?.emails ?? []);
    for (const log of initialLogs) {
      if (log.usuario_email) emails.add(log.usuario_email);
    }
    return [...emails].sort((a, b) => a.localeCompare(b));
  }, [filterSuggestions?.emails, initialLogs]);

  const entidadSuggestions = useMemo(() => {
    const entidades = new Set(filterSuggestions?.entidades ?? []);
    for (const log of initialLogs) {
      if (log.entidad) entidades.add(log.entidad);
    }
    return [...entidades].sort((a, b) => a.localeCompare(b));
  }, [filterSuggestions?.entidades, initialLogs]);

  const stats = useMemo(() => computeAuditStats(logs), [logs]);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageLogs = logs.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const filtersActive = hasActiveFilters({
    entidad,
    usuarioEmail,
    fechaDesde,
    fechaHasta,
  });

  useEffect(() => {
    if (skipAutoFilter.current) {
      skipAutoFilter.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      if (!hasActiveFilters({ entidad, usuarioEmail, fechaDesde, fechaHasta })) {
        setLogs(initialLogs);
        setPage(0);
        return;
      }

      startTransition(async () => {
        const filtered = await filterAuditLogsAction({
          entidad: entidad || undefined,
          usuarioEmail: usuarioEmail || undefined,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
        });
        setLogs(filtered);
        setPage(0);
      });
    }, FILTER_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [entidad, usuarioEmail, fechaDesde, fechaHasta, initialLogs]);

  function clearFilters() {
    setEntidad("");
    setUsuarioEmail("");
    setFechaDesde("");
    setFechaHasta("");
  }

  return (
    <div className="space-y-4">
      <AuditStatsCards stats={stats} />

      <div className="glass grid gap-2 rounded-xl border border-slate-200/60 p-4 sm:grid-cols-4">
        <AuditFilterCombobox
          value={entidad}
          onChange={setEntidad}
          suggestions={entidadSuggestions}
          placeholder="Entidad (kpis, action_plans…)"
          disabled={pending}
        />
        <AuditFilterCombobox
          value={usuarioEmail}
          onChange={setUsuarioEmail}
          suggestions={emailSuggestions}
          placeholder="Usuario (email)"
          disabled={pending}
        />
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          disabled={pending}
          aria-label="Fecha desde"
          className="rounded border px-2 py-1 text-sm disabled:opacity-60"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          disabled={pending}
          aria-label="Fecha hasta"
          className="rounded border px-2 py-1 text-sm disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-2 sm:col-span-4">
          <p className="text-xs text-slate-500">
            {pending
              ? "Actualizando resultados…"
              : "Los filtros se aplican automáticamente al escribir o seleccionar."}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              disabled={pending}
              className="shrink-0 rounded border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="glass overflow-hidden rounded-xl border border-slate-200/60">
        <AuditLogTable logs={pageLogs} namesMap={namesMap} />
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>
            {logs.length} registro{logs.length !== 1 ? "s" : ""} encontrado
            {logs.length !== 1 ? "s" : ""}
          </span>
          {showHuFooter && <span>HU-KPI-012</span>}
        </div>
      </div>

      <PaginationControls
        page={safePage}
        totalPages={totalPages}
        totalItems={logs.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="registros"
      />
    </div>
  );
}

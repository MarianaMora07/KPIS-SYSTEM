"use client";

import { useState, useTransition } from "react";
import { Plug, RefreshCw, CheckCircle, XCircle, Plus, ChevronDown } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";

interface Integration {
  id: string;
  nombre: string;
  sistema_tipo: string;
  endpoint_url: string;
  activa: boolean;
  frecuencia_cron: string | null;
}

interface IntegracionesViewProps {
  integrations: Integration[];
}

export function IntegracionesView({ integrations: initial }: IntegracionesViewProps) {
  const [integrations, setIntegrations] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const { can } = usePermissions();
  const canManage = can("integraciones.gestionar");

  return (
    <div className="space-y-4">
      {canManage && (
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" />
          Nueva integración
        </button>
      )}

      {showForm && canManage && (
        <CreateIntegrationForm
          onCreated={(integration) => {
            setIntegrations((prev) => [...prev, integration]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {integrations.length === 0 ? (
        <div className="glass rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <Plug className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600">No hay integraciones configuradas.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateIntegrationForm({
  onCreated,
  onCancel,
}: {
  onCreated: (i: Integration) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="glass grid gap-3 rounded-xl border border-slate-200/60 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await fetch("/api/integraciones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre: fd.get("nombre"),
              sistema_tipo: fd.get("sistema_tipo"),
              endpoint_url: fd.get("endpoint_url"),
              frecuencia_cron: fd.get("frecuencia_cron") || null,
            }),
          });
          const data = await res.json();
          if (res.ok) onCreated(data);
        });
      }}
    >
      <input name="nombre" placeholder="Nombre" required className="rounded border px-3 py-2 text-sm" />
      <select name="sistema_tipo" required className="rounded border px-3 py-2 text-sm">
        <option value="pms">PMS</option>
        <option value="crm">CRM</option>
        <option value="erp">ERP</option>
        <option value="api_externa">API</option>
      </select>
      <input name="endpoint_url" placeholder="URL endpoint" required className="rounded border px-3 py-2 text-sm sm:col-span-2" />
      <input name="frecuencia_cron" placeholder="Cron (ej: 0 6 * * *)" className="rounded border px-3 py-2 text-sm" />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded bg-imperial-900 px-4 py-2 text-sm text-white">
          Crear
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function IntegrationCard({
  integration,
  canManage,
}: {
  integration: Integration;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [jobs, setJobs] = useState<
    {
      id: string;
      estado: string;
      registros_ok: number | null;
      registros_error: number | null;
      created_at: string;
    }[]
  >([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<
    { id: string; nivel: string; mensaje: string; created_at: string }[]
  >([]);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSync() {
    setLastResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/integraciones/${integration.id}/sync`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al sincronizar");
        setLastResult({
          ok: true,
          message: `Sync: ${data.registrosOk ?? 0} ok, ${data.registrosError ?? 0} errores`,
        });
      } catch (e) {
        setLastResult({
          ok: false,
          message: e instanceof Error ? e.message : "Error",
        });
      }
    });
  }

  async function loadJobLogs(jobId: string) {
    const res = await fetch(`/api/integraciones/${integration.id}/jobs/${jobId}/logs`);
    if (res.ok) {
      setJobLogs(await res.json());
      setExpandedJobId(jobId);
    }
  }

  async function loadJobs() {
    const res = await fetch(`/api/integraciones/${integration.id}/jobs`);
    if (res.ok) setJobs(await res.json());
    setExpanded(true);
    setExpandedJobId(null);
    setJobLogs([]);
  }

  return (
    <li className="glass rounded-xl border border-slate-200/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-50 p-2">
            <Plug className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-medium text-imperial-900">{integration.nombre}</p>
            <p className="text-sm text-slate-500">
              Tipo: {integration.sistema_tipo.toUpperCase()}
              {integration.frecuencia_cron && ` · Cron: ${integration.frecuencia_cron}`}
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">
              {integration.endpoint_url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              integration.activa
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {integration.activa ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {integration.activa ? "Activa" : "Inactiva"}
          </span>
          <button
            type="button"
            onClick={loadJobs}
            className="flex items-center gap-1 text-xs text-slate-500"
          >
            Jobs <ChevronDown className="h-3 w-3" />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={handleSync}
              disabled={pending || !integration.activa}
              className="flex items-center gap-1.5 rounded-lg bg-imperial-900 px-4 py-2 text-sm font-medium text-white hover:bg-imperial-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
          )}
        </div>
      </div>

      {lastResult && (
        <p className={`mt-3 text-sm ${lastResult.ok ? "text-green-600" : "text-red-600"}`}>
          {lastResult.message}
        </p>
      )}

      {expanded && jobs.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {jobs.map((j) => (
            <li key={j.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{j.estado}</span>
                <span>
                  {j.registros_ok ?? 0} ok / {j.registros_error ?? 0} err
                </span>
                <span>{new Date(j.created_at).toLocaleString("es-CO")}</span>
                <button
                  type="button"
                  onClick={() => loadJobLogs(j.id)}
                  className="text-amber-700 hover:underline"
                >
                  Ver logs
                </button>
              </div>
              {expandedJobId === j.id && jobLogs.length > 0 && (
                <ul className="mt-1 space-y-0.5 rounded bg-slate-50 p-2 font-mono">
                  {jobLogs.map((log) => (
                    <li key={log.id}>
                      [{log.nivel}] {log.mensaje}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

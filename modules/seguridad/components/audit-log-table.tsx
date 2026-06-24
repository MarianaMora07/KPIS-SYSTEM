"use client";

import type { AuditLogRow } from "../types";
import { AuditActionBadge } from "./audit-action-badge";
import { AuditChangeDetail } from "./audit-change-detail";

export function AuditLogTable({
  logs,
  namesMap,
}: {
  logs: AuditLogRow[];
  namesMap: Record<string, string>;
}) {
  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Sin registros de auditoría
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Acción</th>
            <th className="px-4 py-3">Entidad</th>
            <th className="px-4 py-3">Detalle del cambio</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-slate-100 align-top">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {log.fecha}{" "}
                {String(log.hora).slice(0, 5)}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">
                <AuditUserCell log={log} namesMap={namesMap} />
              </td>
              <td className="px-4 py-3">
                <AuditActionBadge action={log.accion} />
              </td>
              <td className="px-4 py-3">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                  {log.entidad}
                </span>
                {log.entidad_id && (
                  <span className="ml-1 font-mono text-xs text-slate-400">
                    {log.entidad_id.slice(0, 8)}…
                  </span>
                )}
              </td>
              <td className="max-w-md px-4 py-3">
                <AuditChangeDetail
                  valorAnterior={log.valor_anterior}
                  valorNuevo={log.valor_nuevo}
                  accion={log.accion}
                  namesMap={namesMap}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditUserCell({
  log,
  namesMap,
}: {
  log: AuditLogRow;
  namesMap: Record<string, string>;
}) {
  if (log.usuario_email) return <>{log.usuario_email}</>;
  if (log.usuario_id && namesMap[log.usuario_id]) {
    return <>{namesMap[log.usuario_id]}</>;
  }
  return (
    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
      SISTEMA
    </span>
  );
}

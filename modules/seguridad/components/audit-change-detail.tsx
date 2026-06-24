"use client";

import { formatAuditKey } from "../lib/audit-labels";

function formatAuditValue(
  val: unknown,
  namesMap: Record<string, string>
): string {
  if (val === null || val === undefined || String(val).trim() === "") {
    return "nulo";
  }
  const valStr = String(val);
  if (namesMap[valStr]) return namesMap[valStr];
  if (typeof val === "boolean") return val ? "sí" : "no";
  return valStr;
}

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

export function AuditChangeDetail({
  valorAnterior,
  valorNuevo,
  accion,
  namesMap,
}: {
  valorAnterior: unknown;
  valorNuevo: unknown;
  accion: string;
  namesMap: Record<string, string>;
}) {
  const action = accion?.toLowerCase();

  if (action === "crear") {
    return (
      <span className="text-xs font-semibold text-emerald-600">
        Nuevo registro creado
      </span>
    );
  }

  if (action === "eliminar") {
    return (
      <span className="text-xs font-semibold text-red-600">
        Registro eliminado
      </span>
    );
  }

  const oldVal = asRecord(valorAnterior);
  const newVal = asRecord(valorNuevo);

  if (!oldVal || !newVal) {
    return <span className="text-xs text-slate-400">Sin detalles</span>;
  }

  const changes: React.ReactNode[] = [];

  Object.keys(newVal).forEach((key) => {
    if (key === "updated_at" || key === "_audit_subtype") return;
    if (oldVal[key] !== newVal[key]) {
      const oldStr = formatAuditValue(oldVal[key], namesMap);
      const newStr = formatAuditValue(newVal[key], namesMap);
      const label = formatAuditKey(key);

      changes.push(
        <div key={key} className="mb-1.5 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">{label}:</span>{" "}
          <span className="rounded-md border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-red-600 line-through">
            {oldStr}
          </span>{" "}
          <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-1 py-0.5 font-semibold text-blue-700">
            {newStr}
          </span>
        </div>
      );
    }
  });

  if (changes.length === 0) {
    return (
      <span className="text-xs text-slate-400">Sin cambios detectados</span>
    );
  }

  return <div className="space-y-1">{changes}</div>;
}

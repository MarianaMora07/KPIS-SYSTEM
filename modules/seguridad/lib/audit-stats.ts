import type { AuditLogRow } from "../types";

export interface AuditStats {
  total: number;
  crear: number;
  actualizar: number;
  eliminar: number;
}

export function computeAuditStats(logs: AuditLogRow[]): AuditStats {
  let crear = 0;
  let actualizar = 0;
  let eliminar = 0;

  for (const log of logs) {
    const accion = log.accion?.toLowerCase();
    if (accion === "crear") crear++;
    else if (accion === "actualizar") actualizar++;
    else if (accion === "eliminar") eliminar++;
  }

  return { total: logs.length, crear, actualizar, eliminar };
}

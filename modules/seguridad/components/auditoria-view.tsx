import type { AuditLogRow } from "../types";
import { AuditLogPanel } from "./audit-log-panel";

interface AuditFilterSuggestions {
  emails: string[];
  entidades: string[];
}

interface AuditoriaViewProps {
  auditLogs: AuditLogRow[];
  namesMap: Record<string, string>;
  filterSuggestions?: AuditFilterSuggestions;
}

export function AuditoriaView({
  auditLogs,
  namesMap,
  filterSuggestions,
}: AuditoriaViewProps) {
  return (
    <AuditLogPanel
      initialLogs={auditLogs}
      namesMap={namesMap}
      filterSuggestions={filterSuggestions}
      showHuFooter
    />
  );
}

import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requireAuditoriaAccess } from "@/lib/auth/require-permission";
import {
  listAuditLogs,
  buildAuditNamesMap,
  listAuditFilterSuggestions,
} from "@/modules/seguridad/services/security-service";
import { AuditoriaView } from "@/modules/seguridad/components/auditoria-view";

export default async function AuditoriaPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-sm text-amber-800">
          Configure Supabase para ver la bitácora de auditoría.
        </p>
      </div>
    );
  }

  await requireAuditoriaAccess();

  const [auditLogs, namesMap, filterSuggestions] = await Promise.all([
    listAuditLogs(),
    buildAuditNamesMap(),
    listAuditFilterSuggestions(),
  ]);

  return (
    <AuditoriaView
      auditLogs={auditLogs}
      namesMap={namesMap}
      filterSuggestions={filterSuggestions}
    />
  );
}

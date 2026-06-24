import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  canAccessAuditoriaUi,
  roleHasPermission,
} from "@/lib/auth/role-matrix";
import { getActionPlanById } from "@/modules/alertas/services/alert-service";
import { ActionPlanDetail } from "@/modules/alertas/components/action-plan-detail";
import { listAuditLogs } from "@/modules/seguridad/services/security-service";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ActionPlanDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="glass rounded-xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-sm text-amber-800">
          Configure Supabase para ver el plan de acción.
        </p>
      </div>
    );
  }

  const { rol, permissions } = await requirePermission("alertas.ver");

  const [plan, auditHistory] = await Promise.all([
    getActionPlanById(id),
    canAccessAuditoriaUi(rol, permissions)
      ? listAuditLogs({
          entidad: "action_plans",
          entidadId: id,
          limit: 200,
        })
      : Promise.resolve([]),
  ]);

  const canEditStatus =
    roleHasPermission(rol, "planes.gestionar") || rol === "administrador";

  return (
    <ActionPlanDetail
      plan={plan}
      auditHistory={auditHistory}
      canEditStatus={canEditStatus}
    />
  );
}

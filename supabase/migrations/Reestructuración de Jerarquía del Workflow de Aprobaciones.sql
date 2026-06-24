-- =============================================================================
-- KPIs System — Reestructuración de Jerarquía del Workflow de Aprobaciones
-- =============================================================================

-- 1. Eliminar la política de actualización previa
DROP POLICY IF EXISTS "Update approval requests for approvers" ON public.kpi_approval_requests;

-- 2. Crear la nueva política con alcance segmentado por rol local y global
CREATE POLICY "Update approval requests based on strict hierarchy"
ON public.kpi_approval_requests
FOR UPDATE
USING (
  -- Caso 1: Es el Administrador General (Tiene acceso global)
  fn_current_user_role()::text = 'administrador'
  OR 
  -- Caso 2: Es el Gerente del hotel específico de la solicitud
  (
    fn_current_user_role()::text = 'gerente_hotel' 
    AND fn_user_can_access_hotel(hotel_id)
  )
);
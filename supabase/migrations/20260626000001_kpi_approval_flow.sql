-- =============================================================================
-- KPIs System — IA: Permisos y RLS para Flujo de Aprobaciones (Corrección de ENUM)
-- =============================================================================

-- 1. Agregar permisos a gerente_hotel y analista en role_permissions
-- Casteamos explícitamente al tipo ENUM real de tu base de datos: app_role
INSERT INTO public.role_permissions (rol, permission_id)
SELECT 'gerente_hotel'::app_role, id FROM public.permissions
WHERE codigo IN ('kpis.crear', 'kpis.editar')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (rol, permission_id)
SELECT 'analista'::app_role, id FROM public.permissions
WHERE codigo IN ('kpis.crear', 'kpis.editar', 'metas.configurar')
ON CONFLICT DO NOTHING;

-- 2. Corregir e inyectar políticas RLS seguras para kpi_approval_requests
DROP POLICY IF EXISTS "Usuarios pueden ver solicitudes de su propio hotel" ON public.kpi_approval_requests;
DROP POLICY IF EXISTS "Select approval requests based on hotel scope" ON public.kpi_approval_requests;
DROP POLICY IF EXISTS "Insert approval requests for self" ON public.kpi_approval_requests;
DROP POLICY IF EXISTS "Update approval requests for approvers" ON public.kpi_approval_requests;

-- Política de Lectura (Select)
CREATE POLICY "Select approval requests based on hotel scope"
ON public.kpi_approval_requests
FOR SELECT
USING (fn_user_can_access_hotel(hotel_id));

-- Política de Inserción (Insert)
CREATE POLICY "Insert approval requests for self"
ON public.kpi_approval_requests
FOR INSERT
WITH CHECK (
  auth.uid() = solicitante_id 
  AND fn_user_can_access_hotel(hotel_id)
);

-- Política de Actualización (Update)
-- Mantenemos el casteo ::text en la función de lectura para asegurar la evaluación del arreglo de strings
CREATE POLICY "Update approval requests for approvers"
ON public.kpi_approval_requests
FOR UPDATE
USING (
  fn_user_can_access_hotel(hotel_id) 
  AND (fn_current_user_role()::text IN ('administrador', 'director_comercial', 'director_mercadeo'))
);
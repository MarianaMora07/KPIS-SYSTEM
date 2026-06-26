-- =============================================================================
-- KPIS-SYSTEM -- Hoteles Estelar
-- ESQUEMA 2: ROW LEVEL SECURITY (RLS) Y POLITICAS DE ACCESO
-- Reconstruido desde todas las migraciones (migrations + migrations_archive)
-- Fecha de consolidacion: 2026-06-25
-- =============================================================================
-- Ejecutar DESPUES de schema_01_tablas.sql
-- Requiere que las funciones helper fn_current_user_role, fn_user_has_full_access,
-- fn_user_can_access_hotel, fn_user_can_access_region, fn_user_can_access_kpi
-- ya existan (schema_03_triggers_funciones.sql).
-- NOTA: Se puede ejecutar ambos schemas en orden 01 -> 03 -> 02, o 01 -> 02 -> 03
-- si se definen funciones antes en un mismo archivo.
-- Para comodidad se recomienda: 01_tablas -> 03_triggers -> 02_rls
-- =============================================================================

-- =============================================================================
-- HELPERS RLS
-- (Tambien estan en schema_03 pero se declaran aqui para que RLS pueda
--  referirlos si se aplica este archivo despues de los triggers)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_current_user_role()
RETURNS app_role AS $$
  SELECT ur.rol FROM user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_has_full_access()
RETURNS BOOLEAN AS $$
  SELECT fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'analista'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_can_access_hotel(p_hotel_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    fn_user_has_full_access()
    OR EXISTS (SELECT 1 FROM user_hotel_scopes WHERE user_id = auth.uid() AND hotel_id = p_hotel_id)
    OR EXISTS (
      SELECT 1 FROM user_region_scopes urs
      JOIN hotels h ON h.region_id = urs.region_id
      WHERE urs.user_id = auth.uid() AND h.id = p_hotel_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_can_access_region(p_region_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    fn_user_has_full_access()
    OR EXISTS (SELECT 1 FROM user_region_scopes WHERE user_id = auth.uid() AND region_id = p_region_id)
    OR EXISTS (
      SELECT 1 FROM user_hotel_scopes uhs
      JOIN hotels h ON h.id = uhs.hotel_id
      WHERE uhs.user_id = auth.uid() AND h.region_id = p_region_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Funcion de acceso a KPI por ID (migracion 20250620000001)
CREATE OR REPLACE FUNCTION fn_user_can_access_kpi(p_kpi_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM kpis k
    WHERE k.id = p_kpi_id
    AND (
      fn_user_has_full_access()
      OR (k.hotel_id IS NOT NULL AND fn_user_can_access_hotel(k.hotel_id))
      OR (k.region_id IS NOT NULL AND fn_user_can_access_region(k.region_id))
      OR (k.hotel_id IS NULL AND k.region_id IS NULL)
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- RLS: JERARQUIA ORGANIZACIONAL
-- =============================================================================

-- regions: cualquier autenticado puede leer
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY regions_select ON regions FOR SELECT TO authenticated USING (true);

-- hotels
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY hotels_select ON hotels FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_user_can_access_hotel(id)
  OR fn_user_can_access_region(region_id)
);

CREATE POLICY hotels_insert ON hotels FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY hotels_update ON hotels FOR UPDATE USING (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY hotels_delete ON hotels FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);

-- =============================================================================
-- RLS: KPIs Y CATEGORIAS
-- =============================================================================

-- kpi_categories: lectura publica para autenticados
ALTER TABLE kpi_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_categories_select ON kpi_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_categories_manage ON kpi_categories FOR ALL USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

-- kpis
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpis_select ON kpis FOR SELECT USING (
  fn_user_has_full_access()
  OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  OR (region_id IS NOT NULL AND fn_user_can_access_region(region_id))
  OR (hotel_id IS NULL AND region_id IS NULL)
);

-- Solo administrador puede crear/editar la definicion de KPIs (realineacion 20250622000001)
CREATE POLICY kpis_insert ON kpis FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpis_update ON kpis FOR UPDATE USING (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpis_delete ON kpis FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);

-- =============================================================================
-- RLS: METAS Y SEMAFORO
-- =============================================================================

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_traffic_light_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_targets_select ON kpi_targets FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_targets_insert ON kpi_targets FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
  AND (
    hotel_id IS NULL
    OR fn_user_can_access_hotel(hotel_id)
    OR fn_user_has_full_access()
  )
);

CREATE POLICY kpi_targets_update ON kpi_targets FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_targets_delete ON kpi_targets FOR DELETE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_select ON kpi_traffic_light_ranges FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_insert ON kpi_traffic_light_ranges FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_update ON kpi_traffic_light_ranges FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_delete ON kpi_traffic_light_ranges FOR DELETE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

-- =============================================================================
-- RLS: VALORES KPI
-- =============================================================================

ALTER TABLE kpi_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_values_select ON kpi_values FOR SELECT USING (
  fn_user_has_full_access()
  OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  OR (region_id IS NOT NULL AND fn_user_can_access_region(region_id))
);

CREATE POLICY kpi_values_insert ON kpi_values FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND (
    fn_user_has_full_access()
    OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  )
);

CREATE POLICY kpi_values_update ON kpi_values FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND (
    fn_user_has_full_access()
    OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  )
);

-- Solo administrador elimina valores; analista puede eliminar los de integraciones (migracion 20250628000001_archive)
CREATE POLICY kpi_values_delete ON kpi_values FOR DELETE USING (
  fn_current_user_role() = 'administrador'
  OR (
    fn_current_user_role() = 'analista'
    AND integration_id IS NOT NULL
  )
);

-- =============================================================================
-- RLS: FORMULAS Y VARIABLES
-- =============================================================================

ALTER TABLE kpi_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_formula_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_variables_select ON kpi_variables FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_variables_insert ON kpi_variables FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_variables_update ON kpi_variables FOR UPDATE USING (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_formulas_select ON kpi_formulas FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_formulas_insert ON kpi_formulas FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_formula_variables_select ON kpi_formula_variables FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_formula_variables_insert ON kpi_formula_variables FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_formula_variables_delete ON kpi_formula_variables FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);

-- =============================================================================
-- RLS: IMPORTACIONES
-- =============================================================================

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_jobs_select ON import_jobs FOR SELECT USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

-- Solo roles con permiso import.cargar (migracion 20250623000002_archive)
CREATE POLICY import_jobs_insert ON import_jobs FOR INSERT WITH CHECK (
  auth.uid() = usuario_id
  AND fn_current_user_role() IN ('administrador', 'analista', 'gerente_hotel')
);

CREATE POLICY import_jobs_update ON import_jobs FOR UPDATE USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
) WITH CHECK (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

CREATE POLICY import_jobs_delete ON import_jobs FOR DELETE USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

CREATE POLICY import_job_errors_select ON import_job_errors FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = import_job_id
      AND (ij.usuario_id = auth.uid() OR fn_user_has_full_access())
  )
);

CREATE POLICY import_job_errors_insert ON import_job_errors FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = import_job_id
      AND (ij.usuario_id = auth.uid() OR fn_user_has_full_access())
  )
);

-- =============================================================================
-- RLS: INTEGRACIONES EXTERNAS
-- =============================================================================

ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY external_integrations_select ON external_integrations FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY external_integrations_manage ON external_integrations FOR ALL USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_select ON integration_jobs FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_insert ON integration_jobs FOR INSERT WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_update ON integration_jobs FOR UPDATE USING (
  fn_current_user_role() IN ('administrador', 'analista')
) WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_delete ON integration_jobs FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_select ON integration_logs FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_insert ON integration_logs FOR INSERT WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_delete ON integration_logs FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

-- =============================================================================
-- RLS: ALERTAS
-- =============================================================================

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_select ON alerts FOR SELECT USING (
  fn_user_has_full_access()
  OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  OR (region_id IS NOT NULL AND fn_user_can_access_region(region_id))
);

CREATE POLICY alerts_update ON alerts FOR UPDATE USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('director_comercial', 'director_mercadeo', 'gerente_hotel', 'analista')
);

-- =============================================================================
-- RLS: PLANES DE ACCION
-- =============================================================================

ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_plans_select ON action_plans FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('gerente_hotel', 'director_comercial', 'director_mercadeo')
);

-- Solo directores, gerentes y admin pueden crear/editar planes (realineacion 20250622000001)
CREATE POLICY action_plans_insert ON action_plans FOR INSERT WITH CHECK (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel'
  )
);

CREATE POLICY action_plans_update ON action_plans FOR UPDATE USING (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel'
  )
);

CREATE POLICY action_plans_delete ON action_plans FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.rol IN ('administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel')
  )
);

-- action_plan_items: mismo alcance que action_plans (migracion 20250628000005_archive)
CREATE POLICY action_plan_items_select ON action_plan_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM action_plans ap
    WHERE ap.id = action_plan_items.action_plan_id
  )
);

CREATE POLICY action_plan_items_insert ON action_plan_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.rol IN ('administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel')
  )
);

CREATE POLICY action_plan_items_update ON action_plan_items FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.rol IN ('administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.rol IN ('administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel')
  )
);

CREATE POLICY action_plan_items_delete ON action_plan_items FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.rol IN ('administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel')
  )
);

-- =============================================================================
-- RLS: USUARIOS Y ROLES
-- =============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_hotel_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_region_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select ON user_profiles FOR SELECT USING (
  auth.uid() = id
  OR fn_current_user_role() IN ('administrador', 'director_comercial', 'director_mercadeo')
);

CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE USING (
  auth.uid() = id
  OR fn_current_user_role() = 'administrador'
);

CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (
  auth.uid() = user_id
  OR fn_current_user_role() IN ('administrador', 'director_comercial', 'director_mercadeo')
);

CREATE POLICY user_roles_manage ON user_roles FOR ALL USING (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY user_hotel_scopes_select ON user_hotel_scopes FOR SELECT USING (
  auth.uid() = user_id OR fn_current_user_role() = 'administrador'
);

CREATE POLICY user_hotel_scopes_manage ON user_hotel_scopes FOR ALL USING (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY user_region_scopes_select ON user_region_scopes FOR SELECT USING (
  auth.uid() = user_id OR fn_current_user_role() = 'administrador'
);

CREATE POLICY user_region_scopes_manage ON user_region_scopes FOR ALL USING (
  fn_current_user_role() = 'administrador'
);

-- Catálogo RBAC: lectura para todos los autenticados (migracion 20250628000002_archive)
CREATE POLICY permissions_select ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- RLS: AUDITORIA
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  fn_current_user_role() IN ('administrador', 'director_comercial', 'director_mercadeo')
  OR EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    JOIN user_roles ur ON ur.rol = rp.rol
    WHERE ur.user_id = auth.uid() AND p.codigo = 'auditoria.ver'
  )
);

-- =============================================================================
-- RLS: REPORTES PROGRAMADOS
-- =============================================================================

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_reports_own ON scheduled_reports
  FOR ALL USING (usuario_id = auth.uid());

-- =============================================================================
-- RLS: MODULO IA
-- =============================================================================

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- ai_providers: lectura publica, escritura solo admin
CREATE POLICY ai_providers_select ON ai_providers FOR SELECT TO authenticated USING (true);

CREATE POLICY ai_providers_insert ON ai_providers FOR INSERT TO authenticated
  WITH CHECK (fn_current_user_role() = 'administrador');

CREATE POLICY ai_providers_update ON ai_providers FOR UPDATE TO authenticated
  USING (fn_current_user_role() = 'administrador');

-- ai_configurations: NINGÚN usuario autenticado puede leer directamente las llaves
-- Solo service_role (backend) puede acceder via RPC SECURITY DEFINER
CREATE POLICY ai_configurations_deny_all ON ai_configurations
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false);

-- ai_models: lectura publica, gestion solo admin
CREATE POLICY ai_models_select ON ai_models FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_models_manage ON ai_models FOR ALL TO authenticated
  USING (fn_current_user_role() = 'administrador');

-- ai_usage_logs: admin/analista leen; todos los autenticados insertan
CREATE POLICY ai_usage_logs_select ON ai_usage_logs FOR SELECT USING (
  fn_current_user_role() IN ('administrador', 'analista')
  OR usuario_id = auth.uid()
);

CREATE POLICY ai_usage_logs_insert ON ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- RLS: FUENTES SQL
-- =============================================================================

ALTER TABLE database_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_sql_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY database_connections_select ON database_connections FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista', 'gerente_hotel')
);

CREATE POLICY database_connections_manage ON database_connections FOR ALL USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY kpi_sql_sources_select ON kpi_sql_sources FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista', 'gerente_hotel')
);

CREATE POLICY kpi_sql_sources_manage ON kpi_sql_sources FOR ALL USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

-- =============================================================================
-- RLS: FLUJO DE APROBACIONES
-- =============================================================================

ALTER TABLE public.kpi_approval_requests ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios del mismo hotel
CREATE POLICY "Select approval requests based on hotel scope"
ON public.kpi_approval_requests FOR SELECT
USING (fn_user_can_access_hotel(hotel_id));

-- Insercion: solo el propio solicitante en su hotel
CREATE POLICY "Insert approval requests for self"
ON public.kpi_approval_requests FOR INSERT
WITH CHECK (
  auth.uid() = solicitante_id
  AND fn_user_can_access_hotel(hotel_id)
);

-- Actualizacion: jerarquia estricta (migracion Reestructuracion_Workflow)
-- Admin global O gerente del hotel especifico
CREATE POLICY "Update approval requests based on strict hierarchy"
ON public.kpi_approval_requests FOR UPDATE
USING (
  fn_current_user_role()::text = 'administrador'
  OR (
    fn_current_user_role()::text = 'gerente_hotel'
    AND fn_user_can_access_hotel(hotel_id)
  )
);

-- service_role: control total
CREATE POLICY "Service role control total"
ON public.kpi_approval_requests FOR ALL TO service_role
USING (true);

-- =============================================================================
-- RLS: ADJUNTOS DE MEDICIONES
-- =============================================================================

ALTER TABLE public.kpi_value_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select attachments based on access"
ON public.kpi_value_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.kpi_values kv
    WHERE kv.id = kpi_value_attachments.kpi_value_id
    AND public.fn_user_can_access_hotel(kv.hotel_id)
  )
);

-- Insercion: acceso al hotel del valor (migracion 20260628000002 activo)
CREATE POLICY "Insert attachments based on hotel access"
ON public.kpi_value_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.kpi_values kv
    WHERE kv.id = kpi_value_attachments.kpi_value_id
    AND public.fn_user_can_access_hotel(kv.hotel_id)
  )
);

-- =============================================================================
-- RLS: STORAGE POLICIES
-- =============================================================================

-- Bucket imports (migracion 20250623000002_archive)
DROP POLICY IF EXISTS imports_upload ON storage.objects;
DROP POLICY IF EXISTS imports_read   ON storage.objects;
DROP POLICY IF EXISTS imports_update ON storage.objects;
DROP POLICY IF EXISTS imports_delete ON storage.objects;

CREATE POLICY imports_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY imports_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY imports_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY imports_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Bucket avatars (migracion 20250616000004_archive)
DROP POLICY IF EXISTS avatars_select ON storage.objects;
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;
DROP POLICY IF EXISTS avatars_delete ON storage.objects;

CREATE POLICY avatars_select ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY avatars_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY avatars_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY avatars_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Bucket kpi-evidences (migracion 20260628000001+20260628000002 activo)
DROP POLICY IF EXISTS kpi_evidences_select ON storage.objects;
DROP POLICY IF EXISTS kpi_evidences_insert ON storage.objects;

CREATE POLICY kpi_evidences_select ON storage.objects FOR SELECT
  USING (bucket_id = 'kpi-evidences');

CREATE POLICY kpi_evidences_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kpi-evidences');

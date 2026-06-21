-- =============================================================================
-- Auth trigger, RLS completo y matriz de permisos por rol
-- =============================================================================

-- Perfil automático al registrarse (Supabase Auth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'apellido'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Permisos por rol restantes (HU-KPI-011)
INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_mercadeo', id FROM permissions
WHERE codigo NOT IN ('usuarios.gestionar');

INSERT INTO role_permissions (rol, permission_id)
SELECT 'gerente_hotel', id FROM permissions
WHERE codigo IN (
  'dashboard.ver', 'reportes.exportar', 'import.cargar', 'metas.configurar'
);

INSERT INTO role_permissions (rol, permission_id)
SELECT 'analista', id FROM permissions
WHERE codigo NOT IN ('usuarios.gestionar', 'integraciones.gestionar');

-- ---------------------------------------------------------------------------
-- RLS — hotels
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS — kpis
-- ---------------------------------------------------------------------------
CREATE POLICY kpis_select ON kpis FOR SELECT USING (
  fn_user_has_full_access()
  OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  OR (region_id IS NOT NULL AND fn_user_can_access_region(region_id))
  OR (hotel_id IS NULL AND region_id IS NULL)
);

CREATE POLICY kpis_insert ON kpis FOR INSERT WITH CHECK (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'analista'
  )
);

CREATE POLICY kpis_update ON kpis FOR UPDATE USING (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'analista'
  )
);

CREATE POLICY kpis_delete ON kpis FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);

-- ---------------------------------------------------------------------------
-- RLS — kpi_values (UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE POLICY kpi_values_update ON kpi_values FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND (
    fn_user_has_full_access()
    OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  )
);

CREATE POLICY kpi_values_delete ON kpi_values FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

-- ---------------------------------------------------------------------------
-- RLS — user_profiles y roles
-- ---------------------------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_hotel_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_region_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  fn_current_user_role() IN ('administrador', 'director_comercial', 'director_mercadeo')
  OR EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    JOIN user_roles ur ON ur.rol = rp.rol
    WHERE ur.user_id = auth.uid() AND p.codigo = 'auditoria.ver'
  )
);

-- ---------------------------------------------------------------------------
-- RLS — importaciones e integraciones
-- ---------------------------------------------------------------------------
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_jobs_select ON import_jobs FOR SELECT USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

CREATE POLICY import_jobs_insert ON import_jobs FOR INSERT WITH CHECK (
  auth.uid() = usuario_id
  AND fn_current_user_role() IS DISTINCT FROM 'consulta'
);

CREATE POLICY external_integrations_select ON external_integrations FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY external_integrations_manage ON external_integrations FOR ALL USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

-- ---------------------------------------------------------------------------
-- RLS — alertas y planes de acción
-- ---------------------------------------------------------------------------
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_select ON alerts FOR SELECT USING (
  fn_user_has_full_access()
  OR (hotel_id IS NOT NULL AND fn_user_can_access_hotel(hotel_id))
  OR (region_id IS NOT NULL AND fn_user_can_access_region(region_id))
);

CREATE POLICY action_plans_select ON action_plans FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('gerente_hotel', 'director_comercial', 'director_mercadeo')
);

CREATE POLICY action_plans_insert ON action_plans FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
);

CREATE POLICY action_plans_update ON action_plans FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
);

-- Catálogos de lectura para usuarios autenticados
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY regions_select ON regions FOR SELECT TO authenticated USING (true);
CREATE POLICY kpi_categories_select ON kpi_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_categories_manage ON kpi_categories FOR ALL USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

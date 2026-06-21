-- =============================================================================
-- RBAC realineación por rol (PDF + matriz operativa 2025-06-22)
-- =============================================================================

INSERT INTO permissions (codigo, descripcion, modulo) VALUES
  ('kpis.ver',            'Ver KPIs (solo lectura)',           'kpis'),
  ('catalogo.ver',        'Ver catálogo organizacional',       'catalogo'),
  ('catalogo.gestionar',  'Gestionar catálogo organizacional', 'catalogo'),
  ('alertas.ver',         'Ver alertas',                       'alertas'),
  ('planes.gestionar',    'Gestionar planes de acción',        'alertas')
ON CONFLICT (codigo) DO NOTHING;

-- administrador: todos los permisos
DELETE FROM role_permissions WHERE rol = 'administrador';
INSERT INTO role_permissions (rol, permission_id)
SELECT 'administrador', id FROM permissions;

-- director_comercial / director_mercadeo
DELETE FROM role_permissions WHERE rol IN ('director_comercial', 'director_mercadeo');
INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_comercial', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'kpis.ver', 'reportes.exportar', 'catalogo.ver');
INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_mercadeo', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'kpis.ver', 'reportes.exportar', 'catalogo.ver');

-- gerente_hotel
DELETE FROM role_permissions WHERE rol = 'gerente_hotel';
INSERT INTO role_permissions (rol, permission_id)
SELECT 'gerente_hotel', id FROM permissions
WHERE codigo IN (
  'dashboard.ver', 'kpis.ver', 'metas.configurar', 'import.cargar',
  'reportes.exportar', 'alertas.ver', 'planes.gestionar'
);

-- analista
DELETE FROM role_permissions WHERE rol = 'analista';
INSERT INTO role_permissions (rol, permission_id)
SELECT 'analista', id FROM permissions
WHERE codigo IN (
  'dashboard.ver', 'kpis.ver', 'import.cargar', 'integraciones.gestionar', 'reportes.exportar'
);

-- consulta
DELETE FROM role_permissions WHERE rol = 'consulta';
INSERT INTO role_permissions (rol, permission_id)
SELECT 'consulta', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'kpis.ver', 'reportes.exportar');

-- RLS: solo administrador crea/edita definición de KPIs
DROP POLICY IF EXISTS kpis_insert ON kpis;
CREATE POLICY kpis_insert ON kpis FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

DROP POLICY IF EXISTS kpis_update ON kpis;
CREATE POLICY kpis_update ON kpis FOR UPDATE USING (
  fn_current_user_role() = 'administrador'
);

-- Planes de acción: líderes comerciales, gerentes y admin (no analista/consulta)
DROP POLICY IF EXISTS action_plans_insert ON action_plans;
CREATE POLICY action_plans_insert ON action_plans FOR INSERT WITH CHECK (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel'
  )
);

DROP POLICY IF EXISTS action_plans_update ON action_plans;
CREATE POLICY action_plans_update ON action_plans FOR UPDATE USING (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'gerente_hotel'
  )
);

-- =============================================================================
-- RBAC matrix fix — alinea role_permissions con docs/test-matrix-roles.md
-- =============================================================================

-- director_mercadeo: sin integraciones ni usuarios
DELETE FROM role_permissions
WHERE rol = 'director_mercadeo';

INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_mercadeo', id FROM permissions
WHERE codigo NOT IN ('usuarios.gestionar', 'integraciones.gestionar');

-- analista: todo excepto usuarios (incluye integraciones)
DELETE FROM role_permissions
WHERE rol = 'analista';

INSERT INTO role_permissions (rol, permission_id)
SELECT 'analista', id FROM permissions
WHERE codigo NOT IN ('usuarios.gestionar');

-- gerente_hotel: editar KPIs + metas/import/reportes en su hotel
DELETE FROM role_permissions
WHERE rol = 'gerente_hotel';

INSERT INTO role_permissions (rol, permission_id)
SELECT 'gerente_hotel', id FROM permissions
WHERE codigo IN (
  'dashboard.ver',
  'reportes.exportar',
  'import.cargar',
  'metas.configurar',
  'kpis.editar'
);

-- gerente_hotel puede actualizar KPIs de su hotel (HU-001 editar*)
DROP POLICY IF EXISTS kpis_update ON kpis;

CREATE POLICY kpis_update ON kpis FOR UPDATE USING (
  fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'analista'
  )
  OR (
    fn_current_user_role() = 'gerente_hotel'
    AND hotel_id IS NOT NULL
    AND fn_user_can_access_hotel(hotel_id)
  )
);

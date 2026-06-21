-- =============================================================================
-- Sistema de KPIs — Hoteles Estelar
-- Migración inicial: jerarquía, KPIs, metas, fórmulas, RBAC, auditoría, RLS
-- PostgreSQL 15+ / Supabase
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE kpi_frequency AS ENUM (
  'diaria', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual'
);

CREATE TYPE kpi_indicator_type AS ENUM (
  'estrategico', 'tactico', 'operativo'
);

CREATE TYPE entity_status AS ENUM ('activo', 'inactivo');

CREATE TYPE target_period_type AS ENUM (
  'mensual', 'trimestral', 'semestral', 'anual', 'especial'
);

CREATE TYPE traffic_light_status AS ENUM (
  'cumplimiento', 'riesgo', 'incumplimiento'
);

CREATE TYPE variable_type AS ENUM ('simple', 'compuesta');

CREATE TYPE import_job_status AS ENUM (
  'pendiente', 'procesando', 'completado', 'fallido', 'parcial'
);

CREATE TYPE integration_job_status AS ENUM (
  'pendiente', 'procesando', 'completado', 'fallido', 'reintentando'
);

CREATE TYPE integration_system_type AS ENUM (
  'pms', 'crm', 'erp', 'revenue_management', 'reservas', 'api_externa'
);

CREATE TYPE alert_severity AS ENUM ('riesgo', 'critico');

CREATE TYPE alert_status AS ENUM ('activa', 'escalada', 'resuelta');

CREATE TYPE action_plan_status AS ENUM (
  'abierto', 'en_progreso', 'completado', 'vencido'
);

CREATE TYPE audit_action AS ENUM (
  'crear', 'actualizar', 'eliminar', 'inactivar', 'duplicar',
  'importar', 'integrar', 'calcular', 'exportar'
);

CREATE TYPE app_role AS ENUM (
  'administrador',
  'director_comercial',
  'director_mercadeo',
  'gerente_hotel',
  'analista',
  'consulta'
);

-- ---------------------------------------------------------------------------
-- FEATURE 1 — JERARQUÍA ORGANIZACIONAL (HU-KPI-001)
-- ---------------------------------------------------------------------------
CREATE TABLE regions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(20)  NOT NULL UNIQUE,
  nombre        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  codigo        VARCHAR(20)  NOT NULL UNIQUE,
  nombre        VARCHAR(150) NOT NULL,
  ciudad        VARCHAR(100),
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotels_region_id ON hotels(region_id);

CREATE TABLE business_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  codigo        VARCHAR(20)  NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, codigo)
);
CREATE INDEX idx_business_units_hotel_id ON business_units(hotel_id);

CREATE TABLE sales_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(20)  NOT NULL UNIQUE,
  nombre        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotel_sales_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE RESTRICT,
  estado          entity_status NOT NULL DEFAULT 'activo',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, sales_channel_id)
);
CREATE INDEX idx_hotel_sales_channels_hotel_id ON hotel_sales_channels(hotel_id);

CREATE TABLE marketing_campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     UUID REFERENCES regions(id) ON DELETE SET NULL,
  hotel_id      UUID REFERENCES hotels(id) ON DELETE SET NULL,
  codigo        VARCHAR(30)  NOT NULL UNIQUE,
  nombre        VARCHAR(200) NOT NULL,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  temporada     VARCHAR(100),
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_marketing_campaigns_region_id ON marketing_campaigns(region_id);
CREATE INDEX idx_marketing_campaigns_hotel_id  ON marketing_campaigns(hotel_id);

CREATE TABLE commercial_teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  codigo        VARCHAR(20)  NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  lider_nombre  VARCHAR(150),
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, codigo)
);
CREATE INDEX idx_commercial_teams_hotel_id ON commercial_teams(hotel_id);

-- ---------------------------------------------------------------------------
-- HU-KPI-001 — KPIs
-- ---------------------------------------------------------------------------
CREATE TABLE kpi_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(20)  NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL,
  descripcion   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpi_categories_codigo ON kpi_categories(codigo);

CREATE TABLE kpis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(200) NOT NULL,
  codigo              VARCHAR(50)  NOT NULL UNIQUE,
  categoria_id        UUID NOT NULL REFERENCES kpi_categories(id) ON DELETE RESTRICT,
  area_responsable    VARCHAR(150) NOT NULL,
  responsable_id      UUID,
  frecuencia          kpi_frequency NOT NULL,
  formula             TEXT,
  unidad_medida       VARCHAR(50) NOT NULL,
  meta                NUMERIC(18,4),
  fuente_informacion  VARCHAR(200) NOT NULL,
  tipo_indicador      kpi_indicator_type NOT NULL,
  hotel_id            UUID REFERENCES hotels(id) ON DELETE SET NULL,
  region_id           UUID REFERENCES regions(id) ON DELETE SET NULL,
  business_unit_id    UUID REFERENCES business_units(id) ON DELETE SET NULL,
  sales_channel_id    UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  commercial_team_id  UUID REFERENCES commercial_teams(id) ON DELETE SET NULL,
  estado              entity_status NOT NULL DEFAULT 'activo',
  version_actual      INTEGER NOT NULL DEFAULT 1,
  duplicado_de_id     UUID REFERENCES kpis(id) ON DELETE SET NULL,
  created_by          UUID,
  updated_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpis_categoria_id ON kpis(categoria_id);
CREATE INDEX idx_kpis_hotel_id      ON kpis(hotel_id);
CREATE INDEX idx_kpis_region_id     ON kpis(region_id);
CREATE INDEX idx_kpis_estado        ON kpis(estado);

CREATE TABLE kpi_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id        UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  snapshot      JSONB NOT NULL,
  changed_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, version)
);
CREATE INDEX idx_kpi_versions_kpi_id ON kpi_versions(kpi_id);

-- ---------------------------------------------------------------------------
-- HU-KPI-002 — Metas y semaforización
-- ---------------------------------------------------------------------------
CREATE TABLE kpi_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  periodo_tipo    target_period_type NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  valor_meta      NUMERIC(18,4) NOT NULL,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  region_id       UUID REFERENCES regions(id) ON DELETE CASCADE,
  marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  descripcion     TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_kpi_targets_kpi_id    ON kpi_targets(kpi_id);
CREATE INDEX idx_kpi_targets_hotel_id  ON kpi_targets(hotel_id);
CREATE INDEX idx_kpi_targets_region_id ON kpi_targets(region_id);
CREATE INDEX idx_kpi_targets_fechas    ON kpi_targets(fecha_inicio, fecha_fin);

CREATE TABLE kpi_traffic_light_ranges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  cumplimiento_min_pct  NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  riesgo_min_pct        NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  riesgo_max_pct        NUMERIC(5,2) NOT NULL DEFAULT 99.99,
  incumplimiento_max_pct NUMERIC(5,2) NOT NULL DEFAULT 79.99,
  vigencia_desde        DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta        DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, vigencia_desde)
);
CREATE INDEX idx_traffic_light_kpi_id ON kpi_traffic_light_ranges(kpi_id);

CREATE TABLE kpi_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE SET NULL,
  region_id       UUID REFERENCES regions(id) ON DELETE SET NULL,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
  sales_channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  commercial_team_id UUID REFERENCES commercial_teams(id) ON DELETE SET NULL,
  fecha           DATE NOT NULL,
  valor_real      NUMERIC(18,4) NOT NULL,
  valor_meta      NUMERIC(18,4),
  cumplimiento_pct NUMERIC(7,2),
  semaforo        traffic_light_status,
  fuente          VARCHAR(50) NOT NULL DEFAULT 'manual',
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpi_values_kpi_id    ON kpi_values(kpi_id);
CREATE INDEX idx_kpi_values_hotel_id  ON kpi_values(hotel_id);
CREATE INDEX idx_kpi_values_region_id ON kpi_values(region_id);
CREATE INDEX idx_kpi_values_fecha     ON kpi_values(fecha);
CREATE INDEX idx_kpi_values_semaforo  ON kpi_values(semaforo);
CREATE INDEX idx_kpi_values_composite ON kpi_values(kpi_id, hotel_id, fecha);

CREATE OR REPLACE VIEW v_kpi_values_semaforizado AS
SELECT
  kv.*,
  COALESCE(
    kv.semaforo,
    CASE
      WHEN kv.cumplimiento_pct IS NULL THEN NULL
      WHEN kv.cumplimiento_pct >= COALESCE(tlr.cumplimiento_min_pct, 100) THEN 'cumplimiento'::traffic_light_status
      WHEN kv.cumplimiento_pct BETWEEN COALESCE(tlr.riesgo_min_pct, 80) AND COALESCE(tlr.riesgo_max_pct, 99.99)
        THEN 'riesgo'::traffic_light_status
      ELSE 'incumplimiento'::traffic_light_status
    END
  ) AS semaforo_calculado
FROM kpi_values kv
LEFT JOIN LATERAL (
  SELECT * FROM kpi_traffic_light_ranges t
  WHERE t.kpi_id = kv.kpi_id
    AND t.vigencia_desde <= kv.fecha
    AND (t.vigencia_hasta IS NULL OR t.vigencia_hasta >= kv.fecha)
  ORDER BY t.vigencia_desde DESC
  LIMIT 1
) tlr ON true;

-- ---------------------------------------------------------------------------
-- HU-KPI-003 — Fórmulas y variables
-- ---------------------------------------------------------------------------
CREATE TABLE kpi_variables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(50) NOT NULL UNIQUE,
  nombre        VARCHAR(150) NOT NULL,
  tipo          variable_type NOT NULL DEFAULT 'simple',
  descripcion   TEXT,
  unidad_medida VARCHAR(50),
  formula_compuesta TEXT,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kpi_formulas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id        UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  expresion     TEXT NOT NULL,
  expresion_ast JSONB,
  es_valida     BOOLEAN NOT NULL DEFAULT false,
  validada_at   TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpi_formulas_kpi_id ON kpi_formulas(kpi_id);

CREATE TABLE kpi_formula_variables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id    UUID NOT NULL REFERENCES kpi_formulas(id) ON DELETE CASCADE,
  variable_id   UUID NOT NULL REFERENCES kpi_variables(id) ON DELETE RESTRICT,
  alias         VARCHAR(50),
  UNIQUE (formula_id, variable_id)
);

-- ---------------------------------------------------------------------------
-- HU-KPI-004 — Importación Excel/CSV
-- ---------------------------------------------------------------------------
CREATE TABLE import_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL,
  nombre_archivo  VARCHAR(255) NOT NULL,
  tipo_archivo    VARCHAR(10) NOT NULL CHECK (tipo_archivo IN ('xlsx', 'csv')),
  plantilla_tipo  VARCHAR(100),
  estado          import_job_status NOT NULL DEFAULT 'pendiente',
  total_filas     INTEGER DEFAULT 0,
  filas_ok        INTEGER DEFAULT 0,
  filas_error     INTEGER DEFAULT 0,
  storage_path    TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_jobs_usuario ON import_jobs(usuario_id);
CREATE INDEX idx_import_jobs_estado  ON import_jobs(estado);

CREATE TABLE import_job_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  fila          INTEGER NOT NULL,
  columna       VARCHAR(100),
  valor         TEXT,
  mensaje       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_errors_job ON import_job_errors(import_job_id);

-- ---------------------------------------------------------------------------
-- HU-KPI-005 — Integraciones externas
-- ---------------------------------------------------------------------------
CREATE TABLE external_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(150) NOT NULL,
  sistema_tipo    integration_system_type NOT NULL,
  endpoint_url    TEXT NOT NULL,
  auth_config     JSONB NOT NULL DEFAULT '{}',
  mapeo_campos    JSONB NOT NULL DEFAULT '{}',
  frecuencia_cron VARCHAR(50),
  activa          BOOLEAN NOT NULL DEFAULT true,
  max_reintentos  INTEGER NOT NULL DEFAULT 3,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  estado            integration_job_status NOT NULL DEFAULT 'pendiente',
  intento           INTEGER NOT NULL DEFAULT 0,
  registros_ok      INTEGER DEFAULT 0,
  registros_error   INTEGER DEFAULT 0,
  error_mensaje     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_jobs_integration ON integration_jobs(integration_id);
CREATE INDEX idx_integration_jobs_estado      ON integration_jobs(estado);

CREATE TABLE integration_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_job_id UUID NOT NULL REFERENCES integration_jobs(id) ON DELETE CASCADE,
  nivel             VARCHAR(20) NOT NULL DEFAULT 'info',
  mensaje           TEXT NOT NULL,
  payload           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_logs_job ON integration_logs(integration_job_id);

-- ---------------------------------------------------------------------------
-- HU-KPI-008 — Alertas automáticas
-- ---------------------------------------------------------------------------
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  kpi_value_id    UUID REFERENCES kpi_values(id) ON DELETE SET NULL,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE SET NULL,
  region_id       UUID REFERENCES regions(id) ON DELETE SET NULL,
  severidad       alert_severity NOT NULL,
  estado          alert_status NOT NULL DEFAULT 'activa',
  mensaje         TEXT NOT NULL,
  escalada        BOOLEAN NOT NULL DEFAULT false,
  escalada_at     TIMESTAMPTZ,
  resuelta_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_kpi_id   ON alerts(kpi_id);
CREATE INDEX idx_alerts_estado   ON alerts(estado);
CREATE INDEX idx_alerts_severidad ON alerts(severidad);

-- ---------------------------------------------------------------------------
-- HU-KPI-009 — Planes de acción
-- ---------------------------------------------------------------------------
CREATE TABLE action_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id          UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  alert_id        UUID REFERENCES alerts(id) ON DELETE SET NULL,
  titulo          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  responsable_id  UUID,
  fecha_compromiso DATE NOT NULL,
  estado          action_plan_status NOT NULL DEFAULT 'abierto',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plans_kpi_id ON action_plans(kpi_id);

CREATE TABLE action_plan_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id  UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  responsable_id  UUID,
  fecha_compromiso DATE,
  completado      BOOLEAN NOT NULL DEFAULT false,
  completado_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plan_items_plan ON action_plan_items(action_plan_id);

-- ---------------------------------------------------------------------------
-- HU-KPI-011 — RBAC y perfiles de usuario
-- ---------------------------------------------------------------------------
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  apellido      VARCHAR(150),
  telefono      VARCHAR(30),
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  rol           app_role NOT NULL,
  asignado_por  UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rol)
);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_rol     ON user_roles(rol);

CREATE TABLE user_hotel_scopes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, hotel_id)
);
CREATE INDEX idx_user_hotel_scopes_user  ON user_hotel_scopes(user_id);
CREATE INDEX idx_user_hotel_scopes_hotel ON user_hotel_scopes(hotel_id);

CREATE TABLE user_region_scopes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  region_id     UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, region_id)
);
CREATE INDEX idx_user_region_scopes_user   ON user_region_scopes(user_id);
CREATE INDEX idx_user_region_scopes_region ON user_region_scopes(region_id);

CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(80) NOT NULL UNIQUE,
  descripcion   TEXT NOT NULL,
  modulo        VARCHAR(50) NOT NULL
);

CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol           app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (rol, permission_id)
);

ALTER TABLE kpis
  ADD CONSTRAINT fk_kpis_responsable FOREIGN KEY (responsable_id) REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kpis_created_by   FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kpis_updated_by   FOREIGN KEY (updated_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

ALTER TABLE import_jobs
  ADD CONSTRAINT fk_import_jobs_usuario FOREIGN KEY (usuario_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- HU-KPI-012 — Auditoría estricta
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  usuario_email   VARCHAR(255),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  hora            TIME NOT NULL DEFAULT CURRENT_TIME,
  accion          audit_action NOT NULL,
  entidad         VARCHAR(80) NOT NULL,
  entidad_id      UUID,
  valor_anterior  JSONB,
  valor_nuevo     JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_usuario  ON audit_logs(usuario_id);
CREATE INDEX idx_audit_logs_entidad  ON audit_logs(entidad, entidad_id);
CREATE INDEX idx_audit_logs_fecha    ON audit_logs(fecha);
CREATE INDEX idx_audit_logs_accion   ON audit_logs(accion);

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::UUID,
    auth.uid()
  );
  SELECT email INTO v_user_email FROM user_profiles WHERE id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
    VALUES (v_user_id, v_user_email, 'crear', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
    VALUES (v_user_id, v_user_email, 'actualizar', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
    VALUES (v_user_id, v_user_email, 'eliminar', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_kpis AFTER INSERT OR UPDATE OR DELETE ON kpis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_kpi_targets AFTER INSERT OR UPDATE OR DELETE ON kpi_targets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_kpi_values AFTER INSERT OR UPDATE OR DELETE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION fn_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es inmutable: operación % prohibida', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- RLS helpers (HU-KPI-011)
-- ---------------------------------------------------------------------------
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

ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
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

-- ---------------------------------------------------------------------------
-- SEED — Permisos base
-- ---------------------------------------------------------------------------
INSERT INTO permissions (codigo, descripcion, modulo) VALUES
  ('kpis.crear',       'Crear KPIs',              'kpis'),
  ('kpis.editar',      'Editar KPIs',             'kpis'),
  ('kpis.inactivar',   'Inactivar KPIs',          'kpis'),
  ('metas.configurar', 'Configurar metas',        'metas'),
  ('dashboard.ver',    'Ver dashboards',          'dashboard'),
  ('import.cargar',    'Importar archivos',       'import'),
  ('integraciones.gestionar', 'Gestionar integraciones', 'integraciones'),
  ('reportes.exportar','Exportar reportes',       'reportes'),
  ('usuarios.gestionar','Gestionar usuarios',     'seguridad'),
  ('auditoria.ver',    'Ver bitácora auditoría',  'seguridad');

INSERT INTO role_permissions (rol, permission_id)
SELECT 'administrador', id FROM permissions;

INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_comercial', id FROM permissions
WHERE codigo NOT IN ('usuarios.gestionar');

INSERT INTO role_permissions (rol, permission_id)
SELECT 'consulta', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'reportes.exportar');

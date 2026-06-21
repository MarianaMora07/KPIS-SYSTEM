-- =============================================================================
-- KPIs System — Baseline consolidado (squash de 25 migraciones)
-- Generado: 2026-06-20
-- Ejecutar en base vacia (tras reset en Supabase Dashboard)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SOURCE: 20250614000001_initial_schema.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250614000002_auth_rbac_rls.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250615000003_seed_and_triggers.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Fase 3: Seed demo, cálculo automático de cumplimiento, rol default
-- =============================================================================

-- Rol analista por defecto al registrarse (acceso completo para demo/dev)
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

  INSERT INTO public.user_roles (user_id, rol)
  VALUES (NEW.id, 'analista');

  RETURN NEW;
END;
$$;

-- Auto-calcular cumplimiento_pct al insertar/actualizar valores (HU-KPI-002)
CREATE OR REPLACE FUNCTION fn_kpi_values_calc_cumplimiento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valor_meta IS NOT NULL AND NEW.valor_meta <> 0 THEN
    NEW.cumplimiento_pct := ROUND((NEW.valor_real / NEW.valor_meta) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kpi_values_calc
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_calc_cumplimiento();

-- Vista enriquecida para dashboard (HU-KPI-006)
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  kv.id,
  kv.kpi_id,
  k.nombre AS kpi_nombre,
  k.codigo AS kpi_codigo,
  k.unidad_medida,
  kv.hotel_id,
  h.nombre AS hotel_nombre,
  kv.region_id,
  r.nombre AS region_nombre,
  kv.fecha,
  kv.valor_real,
  kv.valor_meta,
  kv.cumplimiento_pct,
  kv.fuente,
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
JOIN kpis k ON k.id = kv.kpi_id
LEFT JOIN hotels h ON h.id = kv.hotel_id
LEFT JOIN regions r ON r.id = kv.region_id
LEFT JOIN LATERAL (
  SELECT * FROM kpi_traffic_light_ranges t
  WHERE t.kpi_id = kv.kpi_id
    AND t.vigencia_desde <= kv.fecha
    AND (t.vigencia_hasta IS NULL OR t.vigencia_hasta >= kv.fecha)
  ORDER BY t.vigencia_desde DESC
  LIMIT 1
) tlr ON true
WHERE k.estado = 'activo';

GRANT SELECT ON v_dashboard_kpis TO authenticated;

-- ---------------------------------------------------------------------------
-- Datos demo Hoteles Estelar
-- ---------------------------------------------------------------------------
INSERT INTO regions (id, codigo, nombre) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'AND', 'Región Andina'),
  ('a1000000-0000-4000-8000-000000000002', 'CAR', 'Región Caribe'),
  ('a1000000-0000-4000-8000-000000000003', 'PAC', 'Región Pacífico');

INSERT INTO hotels (id, region_id, codigo, nombre, ciudad) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'BOG', 'Estelar Bogotá', 'Bogotá'),
  ('b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'CTG', 'Estelar Cartagena', 'Cartagena'),
  ('b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'CLO', 'Estelar Cali', 'Cali');

INSERT INTO kpi_categories (id, codigo, nombre) VALUES
  ('c3000000-0000-4000-8000-000000000001', 'COM', 'Comercial'),
  ('c3000000-0000-4000-8000-000000000002', 'MKT', 'Mercadeo'),
  ('c3000000-0000-4000-8000-000000000003', 'REV', 'Revenue');

INSERT INTO kpis (id, nombre, codigo, categoria_id, area_responsable, frecuencia, unidad_medida, meta, fuente_informacion, tipo_indicador, hotel_id, region_id) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'Ocupación', 'OCP-001', 'c3000000-0000-4000-8000-000000000001', 'Ventas', 'mensual', '%', 82.0000, 'PMS', 'estrategico', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000002', 'RevPAR', 'RVP-001', 'c3000000-0000-4000-8000-000000000003', 'Revenue', 'mensual', 'COP', 138000.0000, 'PMS', 'estrategico', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000003', 'Conversión web', 'CNV-001', 'c3000000-0000-4000-8000-000000000002', 'Mercadeo Digital', 'mensual', '%', 2.5000, 'CRM', 'tactico', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002'),
  ('d4000000-0000-4000-8000-000000000004', 'NPS', 'NPS-001', 'c3000000-0000-4000-8000-000000000001', 'Experiencia', 'mensual', 'pts', 70.0000, 'Encuestas', 'operativo', 'b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003');

INSERT INTO kpi_traffic_light_ranges (kpi_id, cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct, incumplimiento_max_pct) VALUES
  ('d4000000-0000-4000-8000-000000000001', 100.00, 80.00, 99.99, 79.99),
  ('d4000000-0000-4000-8000-000000000002', 100.00, 80.00, 99.99, 79.99),
  ('d4000000-0000-4000-8000-000000000003', 100.00, 80.00, 99.99, 79.99),
  ('d4000000-0000-4000-8000-000000000004', 100.00, 80.00, 99.99, 79.99);

INSERT INTO kpi_targets (kpi_id, periodo_tipo, fecha_inicio, fecha_fin, valor_meta, hotel_id) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'mensual', '2026-06-01', '2026-06-30', 82.0000, 'b2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000002', 'mensual', '2026-06-01', '2026-06-30', 138000.0000, 'b2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000003', 'mensual', '2026-06-01', '2026-06-30', 2.5000, 'b2000000-0000-4000-8000-000000000002'),
  ('d4000000-0000-4000-8000-000000000004', 'mensual', '2026-06-01', '2026-06-30', 70.0000, 'b2000000-0000-4000-8000-000000000003');

INSERT INTO kpi_values (kpi_id, hotel_id, region_id, fecha, valor_real, valor_meta, fuente) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-06-01', 78.4000, 82.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-06-01', 142500.0000, 138000.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '2026-06-01', 2.1000, 2.5000, 'manual'),
  ('d4000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '2026-06-01', 72.0000, 70.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-05-01', 81.2000, 82.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-05-01', 135000.0000, 138000.0000, 'manual');

-- Histórico adicional para tendencias (HU-KPI-007)
INSERT INTO kpi_values (kpi_id, hotel_id, region_id, fecha, valor_real, valor_meta, fuente) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-04-01', 79.8000, 82.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-03-01', 83.5000, 82.0000, 'manual');


-- -----------------------------------------------------------------------------
-- SOURCE: 20250616000001_alerts_trigger.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Fase 4: Trigger automático de alertas (HU-KPI-008) + seed integración demo
-- =============================================================================

-- Calcula semáforo para un valor KPI
CREATE OR REPLACE FUNCTION fn_calc_semaforo(
  p_kpi_id UUID,
  p_fecha DATE,
  p_cumplimiento_pct NUMERIC
) RETURNS traffic_light_status AS $$
DECLARE
  v_cumplimiento_min NUMERIC;
  v_riesgo_min NUMERIC;
  v_riesgo_max NUMERIC;
BEGIN
  IF p_cumplimiento_pct IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct
  INTO v_cumplimiento_min, v_riesgo_min, v_riesgo_max
  FROM kpi_traffic_light_ranges
  WHERE kpi_id = p_kpi_id
    AND vigencia_desde <= p_fecha
    AND (vigencia_hasta IS NULL OR vigencia_hasta >= p_fecha)
  ORDER BY vigencia_desde DESC
  LIMIT 1;

  v_cumplimiento_min := COALESCE(v_cumplimiento_min, 100);
  v_riesgo_min := COALESCE(v_riesgo_min, 80);
  v_riesgo_max := COALESCE(v_riesgo_max, 99.99);

  IF p_cumplimiento_pct >= v_cumplimiento_min THEN
    RETURN 'cumplimiento';
  ELSIF p_cumplimiento_pct BETWEEN v_riesgo_min AND v_riesgo_max THEN
    RETURN 'riesgo';
  ELSE
    RETURN 'incumplimiento';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Genera alerta cuando un valor queda en riesgo o incumplimiento
CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo traffic_light_status;
  v_kpi_nombre VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_mensaje TEXT;
  v_existe BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE kpi_id = NEW.kpi_id
      AND estado = 'activa'
      AND (hotel_id IS NOT DISTINCT FROM NEW.hotel_id)
      AND kpi_value_id = NEW.id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NULL;
  END IF;

  SELECT nombre INTO v_kpi_nombre FROM kpis WHERE id = NEW.kpi_id;
  SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = NEW.hotel_id;

  IF v_semaforo = 'incumplimiento' THEN
    v_severidad := 'critico';
  ELSE
    v_severidad := 'riesgo';
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
    NEW.valor_real,
    COALESCE(NEW.valor_meta::TEXT, 'N/A'),
    COALESCE(NEW.cumplimiento_pct::TEXT, 'N/A')
  );

  INSERT INTO alerts (
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, 'activa', v_mensaje
  );

  RETURN NULL;
END;
$$;

-- Actualizar semáforo y alertar en BEFORE INSERT/UPDATE
CREATE OR REPLACE FUNCTION fn_kpi_values_set_semaforo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cumplimiento_pct IS NOT NULL THEN
    NEW.semaforo := fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kpi_values_set_semaforo ON kpi_values;
CREATE TRIGGER trg_kpi_values_set_semaforo
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_set_semaforo();

DROP TRIGGER IF EXISTS trg_kpi_values_create_alert ON kpi_values;
CREATE TRIGGER trg_kpi_values_create_alert
  AFTER INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_create_alert();

-- Integración demo PMS (HU-KPI-005)
INSERT INTO external_integrations (id, nombre, sistema_tipo, endpoint_url, auth_config, mapeo_campos, frecuencia_cron, activa)
VALUES (
  'e5000000-0000-4000-8000-000000000001',
  'PMS Estelar Demo',
  'pms',
  'https://api.demo-pms.estelar.local/sync',
  '{"tipo": "api_key", "header": "X-API-Key"}'::jsonb,
  '{"ocupacion": "OCP-001", "revpar": "RVP-001"}'::jsonb,
  '0 6 * * *',
  true
) ON CONFLICT (id) DO NOTHING;

-- Bucket de storage para importaciones (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas storage imports
DROP POLICY IF EXISTS imports_upload ON storage.objects;
DROP POLICY IF EXISTS imports_read ON storage.objects;

CREATE POLICY imports_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY imports_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS action_plan_items
ALTER TABLE action_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_plan_items_select ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_insert ON action_plan_items;

CREATE POLICY action_plan_items_select ON action_plan_items FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IS DISTINCT FROM 'consulta'
);

CREATE POLICY action_plan_items_insert ON action_plan_items FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
);

-- Actualizar alertas (resolver / escalar)
DROP POLICY IF EXISTS alerts_update ON alerts;
CREATE POLICY alerts_update ON alerts FOR UPDATE USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('director_comercial', 'director_mercadeo', 'gerente_hotel', 'analista')
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250616000004_profile_avatar.sql
-- -----------------------------------------------------------------------------

-- Avatar de perfil y bucket de almacenamiento
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250617000001_escalate_reports.sql
-- -----------------------------------------------------------------------------

-- Escalamiento automático de alertas sin plan tras 48h
-- Programación reportes ejecutivos

CREATE OR REPLACE FUNCTION fn_escalate_stale_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escalated_count INTEGER := 0;
BEGIN
  UPDATE alerts a
  SET
    estado = 'escalada',
    escalada = true,
    escalada_at = now()
  WHERE a.estado = 'activa'
    AND a.created_at < now() - interval '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM action_plans ap
      WHERE ap.alert_id = a.id
    );

  GET DIAGNOSTICS escalated_count = ROW_COUNT;
  RETURN escalated_count;
END;
$$;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL,
  nombre        VARCHAR(150) NOT NULL DEFAULT 'Reporte semanal',
  filtros       JSONB NOT NULL DEFAULT '{}',
  frecuencia_cron VARCHAR(50) NOT NULL DEFAULT '0 8 * * 1',
  formato       VARCHAR(20) NOT NULL DEFAULT 'pdf',
  emails        TEXT[] NOT NULL DEFAULT '{}',
  activo        BOOLEAN NOT NULL DEFAULT true,
  ultima_ejecucion TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_activo ON scheduled_reports(activo);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_reports_own ON scheduled_reports
  FOR ALL USING (usuario_id = auth.uid());


-- -----------------------------------------------------------------------------
-- SOURCE: 20250618000001_hu_closure.sql
-- -----------------------------------------------------------------------------

-- HU-KPI-008: escalar automáticamente alertas críticas al crearlas
-- HU-KPI-012: auditoría en integraciones y planes de acción

CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo traffic_light_status;
  v_kpi_nombre VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_mensaje TEXT;
  v_existe BOOLEAN;
  v_estado alert_status;
  v_escalada BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE kpi_id = NEW.kpi_id
      AND estado IN ('activa', 'escalada')
      AND (hotel_id IS NOT DISTINCT FROM NEW.hotel_id)
      AND kpi_value_id = NEW.id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NULL;
  END IF;

  SELECT nombre INTO v_kpi_nombre FROM kpis WHERE id = NEW.kpi_id;
  SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = NEW.hotel_id;

  IF v_semaforo = 'incumplimiento' THEN
    v_severidad := 'critico';
    v_estado := 'escalada';
    v_escalada := true;
  ELSE
    v_severidad := 'riesgo';
    v_estado := 'activa';
    v_escalada := false;
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
    NEW.valor_real,
    COALESCE(NEW.valor_meta::TEXT, 'N/A'),
    COALESCE(NEW.cumplimiento_pct::TEXT, 'N/A')
  );

  INSERT INTO alerts (
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje, escalada, escalada_at
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, v_estado, v_mensaje,
    v_escalada, CASE WHEN v_escalada THEN now() ELSE NULL END
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_external_integrations
  AFTER INSERT OR UPDATE OR DELETE ON external_integrations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_action_plans
  AFTER INSERT OR UPDATE OR DELETE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- -----------------------------------------------------------------------------
-- SOURCE: 20250619000001_rbac_matrix_fix.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250620000001_kpi_targets_rls.sql
-- -----------------------------------------------------------------------------

-- RLS para metas (kpi_targets) y rangos semáforo — HU-KPI-002
-- Sin políticas, INSERT falla si RLS está habilitado en el proyecto.

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

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_traffic_light_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_targets_select ON kpi_targets;
DROP POLICY IF EXISTS kpi_targets_insert ON kpi_targets;
DROP POLICY IF EXISTS kpi_targets_update ON kpi_targets;
DROP POLICY IF EXISTS kpi_targets_delete ON kpi_targets;

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

DROP POLICY IF EXISTS kpi_traffic_light_select ON kpi_traffic_light_ranges;
DROP POLICY IF EXISTS kpi_traffic_light_insert ON kpi_traffic_light_ranges;
DROP POLICY IF EXISTS kpi_traffic_light_update ON kpi_traffic_light_ranges;
DROP POLICY IF EXISTS kpi_traffic_light_delete ON kpi_traffic_light_ranges;

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250621000001_target_expiry_alerts.sql
-- -----------------------------------------------------------------------------

-- Alertas por meta finalizada (HU-KPI-002 / HU-KPI-008)

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS kpi_target_id UUID REFERENCES kpi_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_kpi_target_id ON alerts(kpi_target_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_target_active
  ON alerts(kpi_target_id)
  WHERE kpi_target_id IS NOT NULL AND estado IN ('activa', 'escalada');

CREATE OR REPLACE FUNCTION fn_sync_expired_target_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
  v_hotel_nombre VARCHAR(150);
BEGIN
  FOR r IN
    SELECT
      t.id,
      t.kpi_id,
      t.hotel_id,
      t.region_id,
      t.fecha_inicio,
      t.fecha_fin,
      t.valor_meta,
      t.periodo_tipo,
      k.nombre AS kpi_nombre
    FROM kpi_targets t
    JOIN kpis k ON k.id = t.kpi_id
    WHERE t.fecha_fin < CURRENT_DATE
      AND k.estado = 'activo'
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.kpi_target_id = t.id
          AND a.estado IN ('activa', 'escalada')
      )
  LOOP
    SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = r.hotel_id;

    INSERT INTO alerts (
      kpi_id, kpi_target_id, hotel_id, region_id, severidad, estado, mensaje
    ) VALUES (
      r.kpi_id,
      r.id,
      r.hotel_id,
      r.region_id,
      'riesgo',
      'activa',
      format(
        'Meta finalizada: KPI "%s" — periodo %s (%s a %s)%s. Valor meta: %s.',
        r.kpi_nombre,
        r.periodo_tipo,
        r.fecha_inicio,
        r.fecha_fin,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' · ' || v_hotel_nombre ELSE '' END,
        r.valor_meta
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sync_expired_target_alerts() TO authenticated;


-- -----------------------------------------------------------------------------
-- SOURCE: 20250622000001_rbac_roles_realignment.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250623000001_import_jobs_rls.sql
-- -----------------------------------------------------------------------------

-- Permisos faltantes para procesar importaciones (UPDATE estado, errores por fila)

CREATE POLICY import_jobs_update ON import_jobs FOR UPDATE USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
) WITH CHECK (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

CREATE POLICY import_jobs_delete ON import_jobs FOR DELETE USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

ALTER TABLE import_job_errors ENABLE ROW LEVEL SECURITY;

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


-- -----------------------------------------------------------------------------
-- SOURCE: 20250623000002_imports_storage_policies.sql
-- -----------------------------------------------------------------------------

-- Políticas de storage para el bucket imports (subida, lectura, reemplazo)

DROP POLICY IF EXISTS imports_upload ON storage.objects;
DROP POLICY IF EXISTS imports_read ON storage.objects;
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

-- Alinear INSERT de jobs con roles que tienen import.cargar
DROP POLICY IF EXISTS import_jobs_insert ON import_jobs;
CREATE POLICY import_jobs_insert ON import_jobs FOR INSERT WITH CHECK (
  auth.uid() = usuario_id
  AND fn_current_user_role() IN ('administrador', 'analista', 'gerente_hotel')
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250624000001_kpi_values_delete_rls.sql
-- -----------------------------------------------------------------------------

-- Solo el administrador puede eliminar valores de KPI
DROP POLICY IF EXISTS kpi_values_delete ON kpi_values;

CREATE POLICY kpi_values_delete ON kpi_values FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250625000001_kpi_variables_formulas_rls.sql
-- -----------------------------------------------------------------------------

-- RLS para variables y fórmulas (HU-KPI-003)
-- Sin políticas, INSERT falla si RLS está habilitado en el proyecto.

ALTER TABLE kpi_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_variables_select ON kpi_variables;
DROP POLICY IF EXISTS kpi_variables_insert ON kpi_variables;
DROP POLICY IF EXISTS kpi_variables_update ON kpi_variables;

CREATE POLICY kpi_variables_select ON kpi_variables FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_variables_insert ON kpi_variables FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_variables_update ON kpi_variables FOR UPDATE USING (
  fn_current_user_role() = 'administrador'
);

DROP POLICY IF EXISTS kpi_formulas_select ON kpi_formulas;
DROP POLICY IF EXISTS kpi_formulas_insert ON kpi_formulas;

CREATE POLICY kpi_formulas_select ON kpi_formulas FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_formulas_insert ON kpi_formulas FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
  AND fn_user_can_access_kpi(kpi_id)
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250626000001_kpi_formula_inputs.sql
-- -----------------------------------------------------------------------------

-- HU-KPI-003: inputs por variable y constraint para variables compuestas

ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS variable_inputs JSONB;

COMMENT ON COLUMN kpi_values.variable_inputs IS
  'Valores de entrada por código de variable usados al calcular valor_real';

ALTER TABLE kpi_variables
  DROP CONSTRAINT IF EXISTS kpi_variables_compuesta_formula_chk;

ALTER TABLE kpi_variables
  ADD CONSTRAINT kpi_variables_compuesta_formula_chk CHECK (
    tipo = 'simple'
    OR (tipo = 'compuesta' AND formula_compuesta IS NOT NULL AND trim(formula_compuesta) <> '')
  );

-- RLS para vínculo fórmula ↔ variables
ALTER TABLE kpi_formula_variables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_formula_variables_select ON kpi_formula_variables;
DROP POLICY IF EXISTS kpi_formula_variables_insert ON kpi_formula_variables;
DROP POLICY IF EXISTS kpi_formula_variables_delete ON kpi_formula_variables;

CREATE POLICY kpi_formula_variables_select ON kpi_formula_variables FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_formula_variables_insert ON kpi_formula_variables FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_formula_variables_delete ON kpi_formula_variables FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250627000001_integration_jobs_rls.sql
-- -----------------------------------------------------------------------------

-- HU-KPI-005: políticas RLS para jobs y logs de integraciones (sync manual y cron)

ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_jobs_select ON integration_jobs;
DROP POLICY IF EXISTS integration_jobs_insert ON integration_jobs;
DROP POLICY IF EXISTS integration_jobs_update ON integration_jobs;
DROP POLICY IF EXISTS integration_logs_select ON integration_logs;
DROP POLICY IF EXISTS integration_jobs_delete ON integration_jobs;
DROP POLICY IF EXISTS integration_logs_insert ON integration_logs;
DROP POLICY IF EXISTS integration_logs_delete ON integration_logs;

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

CREATE POLICY integration_logs_select ON integration_logs FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_insert ON integration_logs FOR INSERT WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_delete ON integration_jobs FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_delete ON integration_logs FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250627000002_integration_demo_mapping.sql
-- -----------------------------------------------------------------------------

-- Corregir mapeo demo PMS → códigos KPI del seed (OCP-001, RVP-001)

UPDATE external_integrations
SET mapeo_campos = '{"ocupacion": "OCP-001", "revpar": "RVP-001"}'::jsonb,
    updated_at = now()
WHERE id = 'e5000000-0000-4000-8000-000000000001'
   OR mapeo_campos @> '{"ocupacion": "occupancy_rate"}'::jsonb
   OR mapeo_campos @> '{"revpar": "revpar"}'::jsonb;


-- -----------------------------------------------------------------------------
-- SOURCE: 20250627000003_kpi_values_upsert_unique.sql
-- -----------------------------------------------------------------------------

-- Unicidad para upsert de integraciones: (kpi_id, hotel_id, fecha)

-- Conservar el registro más reciente si hay duplicados
DELETE FROM kpi_values a
USING kpi_values b
WHERE a.kpi_id = b.kpi_id
  AND a.hotel_id IS NOT DISTINCT FROM b.hotel_id
  AND a.fecha = b.fecha
  AND a.created_at < b.created_at;

DELETE FROM kpi_values a
USING kpi_values b
WHERE a.kpi_id = b.kpi_id
  AND a.hotel_id IS NOT DISTINCT FROM b.hotel_id
  AND a.fecha = b.fecha
  AND a.id < b.id;

DROP INDEX IF EXISTS idx_kpi_values_composite;

CREATE UNIQUE INDEX idx_kpi_values_kpi_hotel_fecha
  ON kpi_values (kpi_id, hotel_id, fecha);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250628000001_kpi_values_integration_id.sql
-- -----------------------------------------------------------------------------

-- Vincular valores KPI a la integración que los cargó (eliminación en cascada)

ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES external_integrations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_kpi_values_integration_id ON kpi_values(integration_id);

COMMENT ON COLUMN kpi_values.integration_id IS
  'Integración que cargó el valor; NULL para manual/import';

DROP POLICY IF EXISTS kpi_values_delete ON kpi_values;

CREATE POLICY kpi_values_delete ON kpi_values FOR DELETE USING (
  fn_current_user_role() = 'administrador'
  OR (
    fn_current_user_role() = 'analista'
    AND integration_id IS NOT NULL
  )
);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250628000002_permissions_rls.sql
-- -----------------------------------------------------------------------------

-- Lectura del catálogo RBAC para usuarios autenticados.
-- Sin políticas, RLS devuelve 0 filas aunque el seed esté aplicado.

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_select ON permissions;
CREATE POLICY permissions_select ON permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select ON role_permissions
  FOR SELECT TO authenticated
  USING (true);


-- -----------------------------------------------------------------------------
-- SOURCE: 20250628000003_kpi_value_alerts_sync.sql
-- -----------------------------------------------------------------------------

-- Sincroniza alertas desde valores KPI en riesgo/incumplimiento (backfill + alineación con dashboard)

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_kpi_value_open
  ON alerts(kpi_value_id)
  WHERE kpi_value_id IS NOT NULL AND estado IN ('activa', 'escalada');

CREATE OR REPLACE FUNCTION fn_sync_kpi_value_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_estado alert_status;
  v_escalada BOOLEAN;
BEGIN
  FOR r IN
    WITH ranked AS (
      SELECT
        kv.id,
        kv.kpi_id,
        kv.hotel_id,
        kv.region_id,
        kv.valor_real,
        kv.valor_meta,
        kv.cumplimiento_pct,
        COALESCE(
          kv.semaforo,
          fn_calc_semaforo(kv.kpi_id, kv.fecha, kv.cumplimiento_pct)
        ) AS semaforo_calc,
        k.nombre AS kpi_nombre,
        ROW_NUMBER() OVER (
          PARTITION BY kv.kpi_id, kv.hotel_id, kv.region_id
          ORDER BY kv.fecha DESC, kv.created_at DESC
        ) AS rn
      FROM kpi_values kv
      JOIN kpis k ON k.id = kv.kpi_id AND k.estado = 'activo'
      WHERE kv.cumplimiento_pct IS NOT NULL
    )
    SELECT *
    FROM ranked
    WHERE rn = 1
      AND semaforo_calc IN ('riesgo', 'incumplimiento')
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.kpi_value_id = ranked.id
          AND a.estado IN ('activa', 'escalada')
      )
  LOOP
    SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = r.hotel_id;

    IF r.semaforo_calc = 'incumplimiento' THEN
      v_severidad := 'critico';
      v_estado := 'escalada';
      v_escalada := true;
    ELSE
      v_severidad := 'riesgo';
      v_estado := 'activa';
      v_escalada := false;
    END IF;

    INSERT INTO alerts (
      kpi_id,
      kpi_value_id,
      hotel_id,
      region_id,
      severidad,
      estado,
      mensaje,
      escalada,
      escalada_at
    ) VALUES (
      r.kpi_id,
      r.id,
      r.hotel_id,
      r.region_id,
      v_severidad,
      v_estado,
      format(
        'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
        r.kpi_nombre,
        r.semaforo_calc,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
        r.valor_real,
        COALESCE(r.valor_meta::TEXT, 'N/A'),
        COALESCE(r.cumplimiento_pct::TEXT, 'N/A')
      ),
      v_escalada,
      CASE WHEN v_escalada THEN now() ELSE NULL END
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sync_kpi_value_alerts() TO authenticated;


-- -----------------------------------------------------------------------------
-- SOURCE: 20250628000004_alerts_pipeline_repair.sql
-- -----------------------------------------------------------------------------

-- Reparación pipeline de alertas (HU-KPI-008)
-- Aplica si fn_calc_semaforo / triggers no existen en el proyecto remoto.

CREATE OR REPLACE FUNCTION fn_calc_semaforo(
  p_kpi_id UUID,
  p_fecha DATE,
  p_cumplimiento_pct NUMERIC
) RETURNS traffic_light_status AS $$
DECLARE
  v_cumplimiento_min NUMERIC;
  v_riesgo_min NUMERIC;
  v_riesgo_max NUMERIC;
BEGIN
  IF p_cumplimiento_pct IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct
  INTO v_cumplimiento_min, v_riesgo_min, v_riesgo_max
  FROM kpi_traffic_light_ranges
  WHERE kpi_id = p_kpi_id
    AND vigencia_desde <= p_fecha
    AND (vigencia_hasta IS NULL OR vigencia_hasta >= p_fecha)
  ORDER BY vigencia_desde DESC
  LIMIT 1;

  v_cumplimiento_min := COALESCE(v_cumplimiento_min, 100);
  v_riesgo_min := COALESCE(v_riesgo_min, 80);
  v_riesgo_max := COALESCE(v_riesgo_max, 99.99);

  IF p_cumplimiento_pct >= v_cumplimiento_min THEN
    RETURN 'cumplimiento';
  ELSIF p_cumplimiento_pct BETWEEN v_riesgo_min AND v_riesgo_max THEN
    RETURN 'riesgo';
  ELSE
    RETURN 'incumplimiento';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_kpi_values_set_semaforo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cumplimiento_pct IS NOT NULL THEN
    NEW.semaforo := fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo traffic_light_status;
  v_kpi_nombre VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_mensaje TEXT;
  v_existe BOOLEAN;
  v_estado alert_status;
  v_escalada BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE kpi_id = NEW.kpi_id
      AND estado IN ('activa', 'escalada')
      AND (hotel_id IS NOT DISTINCT FROM NEW.hotel_id)
      AND kpi_value_id = NEW.id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NULL;
  END IF;

  SELECT nombre INTO v_kpi_nombre FROM kpis WHERE id = NEW.kpi_id;
  SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = NEW.hotel_id;

  IF v_semaforo = 'incumplimiento' THEN
    v_severidad := 'critico';
    v_estado := 'escalada';
    v_escalada := true;
  ELSE
    v_severidad := 'riesgo';
    v_estado := 'activa';
    v_escalada := false;
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
    NEW.valor_real,
    COALESCE(NEW.valor_meta::TEXT, 'N/A'),
    COALESCE(NEW.cumplimiento_pct::TEXT, 'N/A')
  );

  INSERT INTO alerts (
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje, escalada, escalada_at
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, v_estado, v_mensaje,
    v_escalada, CASE WHEN v_escalada THEN now() ELSE NULL END
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_kpi_values_set_semaforo ON kpi_values;
CREATE TRIGGER trg_kpi_values_set_semaforo
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_set_semaforo();

DROP TRIGGER IF EXISTS trg_kpi_values_create_alert ON kpi_values;
CREATE TRIGGER trg_kpi_values_create_alert
  AFTER INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_create_alert();

-- Semáforo en valores históricos
UPDATE kpi_values
SET semaforo = fn_calc_semaforo(kpi_id, fecha, cumplimiento_pct)
WHERE cumplimiento_pct IS NOT NULL
  AND (semaforo IS NULL OR semaforo <> fn_calc_semaforo(kpi_id, fecha, cumplimiento_pct));

-- Requiere fn_sync_kpi_value_alerts (migración 20250628000003)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'fn_sync_kpi_value_alerts'
  ) THEN
    PERFORM fn_sync_kpi_value_alerts();
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- SOURCE: 20250628000005_action_plan_items_rls.sql
-- -----------------------------------------------------------------------------

-- RLS action_plan_items — alineado con action_plans (HU-KPI-009)
-- El plan padre podía insertarse; los ítems fallaban sin política INSERT/UPDATE coherente.

ALTER TABLE action_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_plan_items_select ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_insert ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_update ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_delete ON action_plan_items;

-- Lectura: si puede ver el plan padre, puede ver sus ítems
CREATE POLICY action_plan_items_select ON action_plan_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM action_plans ap
      WHERE ap.id = action_plan_items.action_plan_id
    )
  );

-- Escritura: mismos roles que action_plans_insert (admin, directores, gerente)
CREATE POLICY action_plan_items_insert ON action_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );

CREATE POLICY action_plan_items_update ON action_plan_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );

CREATE POLICY action_plan_items_delete ON action_plan_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );

-- Eliminar plan completo (ítems en cascada por FK)
DROP POLICY IF EXISTS action_plans_delete ON action_plans;
CREATE POLICY action_plans_delete ON action_plans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );


-- -----------------------------------------------------------------------------
-- SOURCE: 20250628000006_alert_resolve_no_recreate.sql
-- -----------------------------------------------------------------------------

-- Evita recrear alertas para un kpi_value que ya tuvo alerta (incl. resuelta manualmente)

CREATE OR REPLACE FUNCTION fn_sync_kpi_value_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_estado alert_status;
  v_escalada BOOLEAN;
BEGIN
  FOR r IN
    WITH ranked AS (
      SELECT
        kv.id,
        kv.kpi_id,
        kv.hotel_id,
        kv.region_id,
        kv.valor_real,
        kv.valor_meta,
        kv.cumplimiento_pct,
        COALESCE(
          kv.semaforo,
          fn_calc_semaforo(kv.kpi_id, kv.fecha, kv.cumplimiento_pct)
        ) AS semaforo_calc,
        k.nombre AS kpi_nombre,
        ROW_NUMBER() OVER (
          PARTITION BY kv.kpi_id, kv.hotel_id, kv.region_id
          ORDER BY kv.fecha DESC, kv.created_at DESC
        ) AS rn
      FROM kpi_values kv
      JOIN kpis k ON k.id = kv.kpi_id AND k.estado = 'activo'
      WHERE kv.cumplimiento_pct IS NOT NULL
    )
    SELECT *
    FROM ranked
    WHERE rn = 1
      AND semaforo_calc IN ('riesgo', 'incumplimiento')
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.kpi_value_id = ranked.id
      )
  LOOP
    SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = r.hotel_id;

    IF r.semaforo_calc = 'incumplimiento' THEN
      v_severidad := 'critico';
      v_estado := 'escalada';
      v_escalada := true;
    ELSE
      v_severidad := 'riesgo';
      v_estado := 'activa';
      v_escalada := false;
    END IF;

    INSERT INTO alerts (
      kpi_id,
      kpi_value_id,
      hotel_id,
      region_id,
      severidad,
      estado,
      mensaje,
      escalada,
      escalada_at
    ) VALUES (
      r.kpi_id,
      r.id,
      r.hotel_id,
      r.region_id,
      v_severidad,
      v_estado,
      format(
        'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
        r.kpi_nombre,
        r.semaforo_calc,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
        r.valor_real,
        COALESCE(r.valor_meta::TEXT, 'N/A'),
        COALESCE(r.cumplimiento_pct::TEXT, 'N/A')
      ),
      v_escalada,
      CASE WHEN v_escalada THEN now() ELSE NULL END
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo traffic_light_status;
  v_kpi_nombre VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_mensaje TEXT;
  v_existe BOOLEAN;
  v_estado alert_status;
  v_escalada BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE kpi_value_id = NEW.id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NULL;
  END IF;

  SELECT nombre INTO v_kpi_nombre FROM kpis WHERE id = NEW.kpi_id;
  SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = NEW.hotel_id;

  IF v_semaforo = 'incumplimiento' THEN
    v_severidad := 'critico';
    v_estado := 'escalada';
    v_escalada := true;
  ELSE
    v_severidad := 'riesgo';
    v_estado := 'activa';
    v_escalada := false;
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
    NEW.valor_real,
    COALESCE(NEW.valor_meta::TEXT, 'N/A'),
    COALESCE(NEW.cumplimiento_pct::TEXT, 'N/A')
  );

  INSERT INTO alerts (
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje, escalada, escalada_at
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, v_estado, v_mensaje,
    v_escalada, CASE WHEN v_escalada THEN now() ELSE NULL END
  );

  RETURN NULL;
END;
$$;


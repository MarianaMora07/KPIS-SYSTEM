
import os

BASE = r"c:\Users\AveRyCarNey\Desktop\Venesoft Curso\Proyecto Estelar\Estelar\KPIS-SYSTEM\supabase"

# ===========================================================================
# SCHEMA 1: TABLES
# ===========================================================================
SCHEMA_TABLAS = r"""-- =============================================================================
-- KPIS-SYSTEM -- Hoteles Estelar
-- ESQUEMA 1: TABLAS, TIPOS, INDICES Y VISTAS
-- Reconstruido desde todas las migraciones (migrations + migrations_archive)
-- Fecha de consolidacion: 2026-06-25
-- =============================================================================
-- Ejecutar en una base de datos VACIA antes de los demas esquemas.
-- Orden de ejecucion recomendado:
--   1. schema_01_tablas.sql
--   2. schema_02_rls_permisos.sql
--   3. schema_03_triggers_funciones.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONES
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

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
  'pms', 'crm', 'erp', 'revenue_management', 'reservas', 'api_externa', 'sql_database'
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

-- Flujo de aprobaciones (migracion 20260625500001)
DO $block$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $block$;

DO $block$ BEGIN
  CREATE TYPE request_type AS ENUM ('creacion', 'edicion', 'medicion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $block$;

-- Conexiones de base de datos (migracion 20260625000001)
DO $block$ BEGIN
  CREATE TYPE database_connection_type AS ENUM ('supabase_internal', 'postgres_external');
EXCEPTION WHEN duplicate_object THEN NULL;
END $block$;

-- =============================================================================
-- FEATURE 1: JERARQUIA ORGANIZACIONAL (HU-KPI-001)
-- =============================================================================

CREATE TABLE regions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20)  NOT NULL UNIQUE,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  estado      entity_status NOT NULL DEFAULT 'activo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id  UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  codigo     VARCHAR(20)  NOT NULL UNIQUE,
  nombre     VARCHAR(150) NOT NULL,
  ciudad     VARCHAR(100),
  estado     entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotels_region_id ON hotels(region_id);

CREATE TABLE business_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  codigo      VARCHAR(20)  NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  estado      entity_status NOT NULL DEFAULT 'activo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, codigo)
);
CREATE INDEX idx_business_units_hotel_id ON business_units(hotel_id);

CREATE TABLE sales_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20)  NOT NULL UNIQUE,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  estado      entity_status NOT NULL DEFAULT 'activo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hotel_sales_channels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE RESTRICT,
  estado           entity_status NOT NULL DEFAULT 'activo',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, sales_channel_id)
);
CREATE INDEX idx_hotel_sales_channels_hotel_id ON hotel_sales_channels(hotel_id);

CREATE TABLE marketing_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    UUID REFERENCES regions(id) ON DELETE SET NULL,
  hotel_id     UUID REFERENCES hotels(id) ON DELETE SET NULL,
  codigo       VARCHAR(30)  NOT NULL UNIQUE,
  nombre       VARCHAR(200) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  temporada    VARCHAR(100),
  estado       entity_status NOT NULL DEFAULT 'activo',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_marketing_campaigns_region_id ON marketing_campaigns(region_id);
CREATE INDEX idx_marketing_campaigns_hotel_id  ON marketing_campaigns(hotel_id);

CREATE TABLE commercial_teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  codigo       VARCHAR(20)  NOT NULL,
  nombre       VARCHAR(150) NOT NULL,
  lider_nombre VARCHAR(150),
  estado       entity_status NOT NULL DEFAULT 'activo',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, codigo)
);
CREATE INDEX idx_commercial_teams_hotel_id ON commercial_teams(hotel_id);

-- =============================================================================
-- HU-KPI-011: RBAC y perfiles de usuario
-- (Creado antes de kpis para los FK cruzados)
-- =============================================================================

CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  nombre     VARCHAR(150) NOT NULL,
  apellido   VARCHAR(150),
  telefono   VARCHAR(30),
  avatar_url TEXT,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  rol          app_role NOT NULL,
  asignado_por UUID REFERENCES user_profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rol)
);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_rol     ON user_roles(rol);

CREATE TABLE user_hotel_scopes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  hotel_id   UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, hotel_id)
);
CREATE INDEX idx_user_hotel_scopes_user  ON user_hotel_scopes(user_id);
CREATE INDEX idx_user_hotel_scopes_hotel ON user_hotel_scopes(hotel_id);

CREATE TABLE user_region_scopes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  region_id  UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, region_id)
);
CREATE INDEX idx_user_region_scopes_user   ON user_region_scopes(user_id);
CREATE INDEX idx_user_region_scopes_region ON user_region_scopes(region_id);

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(80) NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  modulo      VARCHAR(50) NOT NULL
);

CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol           app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (rol, permission_id)
);

-- =============================================================================
-- HU-KPI-001: Categorias y KPIs
-- =============================================================================

CREATE TABLE kpi_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20)  NOT NULL UNIQUE,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpi_categories_codigo ON kpi_categories(codigo);

CREATE TABLE kpis (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                    VARCHAR(200) NOT NULL,
  codigo                    VARCHAR(50)  NOT NULL UNIQUE,
  categoria_id              UUID NOT NULL REFERENCES kpi_categories(id) ON DELETE RESTRICT,
  area_responsable          VARCHAR(150) NOT NULL,
  responsable_id            UUID,
  frecuencia                kpi_frequency NOT NULL,
  formula                   TEXT,
  unidad_medida             VARCHAR(50) NOT NULL,
  meta                      NUMERIC(18,4),
  fuente_informacion        VARCHAR(200) NOT NULL,
  tipo_indicador            kpi_indicator_type NOT NULL,
  hotel_id                  UUID REFERENCES hotels(id) ON DELETE SET NULL,
  region_id                 UUID REFERENCES regions(id) ON DELETE SET NULL,
  business_unit_id          UUID REFERENCES business_units(id) ON DELETE SET NULL,
  sales_channel_id          UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  marketing_campaign_id     UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  commercial_team_id        UUID REFERENCES commercial_teams(id) ON DELETE SET NULL,
  estado                    entity_status NOT NULL DEFAULT 'activo',
  version_actual            INTEGER NOT NULL DEFAULT 1,
  duplicado_de_id           UUID REFERENCES kpis(id) ON DELETE SET NULL,
  -- Recordatorios (migracion 20250621000001_kpi_review_reminders)
  recordatorio_email_activo BOOLEAN NOT NULL DEFAULT false,
  recordatorio_emails       TEXT[] NOT NULL DEFAULT '{}',
  ultimo_recordatorio_at    TIMESTAMPTZ,
  created_by                UUID,
  updated_by                UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpis_categoria_id ON kpis(categoria_id);
CREATE INDEX idx_kpis_hotel_id     ON kpis(hotel_id);
CREATE INDEX idx_kpis_region_id    ON kpis(region_id);
CREATE INDEX idx_kpis_estado       ON kpis(estado);

ALTER TABLE kpis
  ADD CONSTRAINT fk_kpis_responsable FOREIGN KEY (responsable_id) REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kpis_created_by  FOREIGN KEY (created_by)     REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kpis_updated_by  FOREIGN KEY (updated_by)     REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE TABLE kpi_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id     UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  snapshot   JSONB NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, version)
);
CREATE INDEX idx_kpi_versions_kpi_id ON kpi_versions(kpi_id);

-- =============================================================================
-- HU-KPI-002: Metas y semaforizacion
-- =============================================================================

CREATE TABLE kpi_targets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  periodo_tipo          target_period_type NOT NULL,
  fecha_inicio          DATE NOT NULL,
  fecha_fin             DATE NOT NULL,
  valor_meta            NUMERIC(18,4) NOT NULL,
  hotel_id              UUID REFERENCES hotels(id) ON DELETE CASCADE,
  region_id             UUID REFERENCES regions(id) ON DELETE CASCADE,
  marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  descripcion           TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_kpi_targets_kpi_id    ON kpi_targets(kpi_id);
CREATE INDEX idx_kpi_targets_hotel_id  ON kpi_targets(hotel_id);
CREATE INDEX idx_kpi_targets_region_id ON kpi_targets(region_id);
CREATE INDEX idx_kpi_targets_fechas    ON kpi_targets(fecha_inicio, fecha_fin);

CREATE TABLE kpi_traffic_light_ranges (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                 UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  cumplimiento_min_pct   NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  riesgo_min_pct         NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  riesgo_max_pct         NUMERIC(5,2) NOT NULL DEFAULT 99.99,
  incumplimiento_max_pct NUMERIC(5,2) NOT NULL DEFAULT 79.99,
  vigencia_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta         DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, vigencia_desde)
);
CREATE INDEX idx_traffic_light_kpi_id ON kpi_traffic_light_ranges(kpi_id);

-- =============================================================================
-- HU-KPI-004: Importacion Excel/CSV
-- =============================================================================

CREATE TABLE import_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_archivo   VARCHAR(10) NOT NULL CHECK (tipo_archivo IN ('xlsx', 'csv')),
  plantilla_tipo VARCHAR(100),
  estado         import_job_status NOT NULL DEFAULT 'pendiente',
  total_filas    INTEGER DEFAULT 0,
  filas_ok       INTEGER DEFAULT 0,
  filas_error    INTEGER DEFAULT 0,
  storage_path   TEXT,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_jobs_usuario ON import_jobs(usuario_id);
CREATE INDEX idx_import_jobs_estado  ON import_jobs(estado);

ALTER TABLE import_jobs
  ADD CONSTRAINT fk_import_jobs_usuario FOREIGN KEY (usuario_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

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

-- =============================================================================
-- HU-KPI-005: Integraciones externas
-- =============================================================================

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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  estado          integration_job_status NOT NULL DEFAULT 'pendiente',
  intento         INTEGER NOT NULL DEFAULT 0,
  registros_ok    INTEGER DEFAULT 0,
  registros_error INTEGER DEFAULT 0,
  error_mensaje   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_jobs_integration ON integration_jobs(integration_id);
CREATE INDEX idx_integration_jobs_estado      ON integration_jobs(estado);

CREATE TABLE integration_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_job_id UUID NOT NULL REFERENCES integration_jobs(id) ON DELETE CASCADE,
  nivel              VARCHAR(20) NOT NULL DEFAULT 'info',
  mensaje            TEXT NOT NULL,
  payload            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_logs_job ON integration_logs(integration_job_id);

-- =============================================================================
-- HU-KPI-003: Formulas y variables
-- =============================================================================

CREATE TABLE kpi_variables (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            VARCHAR(50) NOT NULL UNIQUE,
  nombre            VARCHAR(150) NOT NULL,
  tipo              variable_type NOT NULL DEFAULT 'simple',
  descripcion       TEXT,
  unidad_medida     VARCHAR(50),
  formula_compuesta TEXT,
  estado            entity_status NOT NULL DEFAULT 'activo',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint para variables compuestas (migracion 20250626000001)
  CONSTRAINT kpi_variables_compuesta_formula_chk CHECK (
    tipo = 'simple'
    OR (tipo = 'compuesta' AND formula_compuesta IS NOT NULL AND trim(formula_compuesta) <> '')
  )
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
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id  UUID NOT NULL REFERENCES kpi_formulas(id) ON DELETE CASCADE,
  variable_id UUID NOT NULL REFERENCES kpi_variables(id) ON DELETE RESTRICT,
  alias       VARCHAR(50),
  UNIQUE (formula_id, variable_id)
);

-- =============================================================================
-- HU-KPI-002: Valores KPI
-- =============================================================================

CREATE TABLE kpi_values (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  hotel_id              UUID REFERENCES hotels(id) ON DELETE SET NULL,
  region_id             UUID REFERENCES regions(id) ON DELETE SET NULL,
  business_unit_id      UUID REFERENCES business_units(id) ON DELETE SET NULL,
  sales_channel_id      UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  commercial_team_id    UUID REFERENCES commercial_teams(id) ON DELETE SET NULL,
  fecha                 DATE NOT NULL,
  valor_real            NUMERIC(18,4) NOT NULL,
  valor_meta            NUMERIC(18,4),
  cumplimiento_pct      NUMERIC(7,2),
  semaforo              traffic_light_status,
  fuente                VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- Variable inputs para calculo por formula (migracion 20250626000001)
  variable_inputs       JSONB,
  -- Vinculo a integracion origen (migracion 20250628000001_archive)
  integration_id        UUID REFERENCES external_integrations(id) ON DELETE CASCADE,
  calculated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN kpi_values.variable_inputs IS 'Valores de entrada por codigo de variable usados al calcular valor_real';
COMMENT ON COLUMN kpi_values.integration_id  IS 'Integracion que cargo el valor; NULL para manual/import';

CREATE INDEX idx_kpi_values_kpi_id         ON kpi_values(kpi_id);
CREATE INDEX idx_kpi_values_hotel_id       ON kpi_values(hotel_id);
CREATE INDEX idx_kpi_values_region_id      ON kpi_values(region_id);
CREATE INDEX idx_kpi_values_fecha          ON kpi_values(fecha);
CREATE INDEX idx_kpi_values_semaforo       ON kpi_values(semaforo);
CREATE INDEX idx_kpi_values_integration_id ON kpi_values(integration_id);
-- Indice unico para upsert de integraciones (migracion 20250627000003_archive)
CREATE UNIQUE INDEX idx_kpi_values_kpi_hotel_fecha ON kpi_values (kpi_id, hotel_id, fecha);

-- =============================================================================
-- HU-KPI-008: Alertas automaticas
-- =============================================================================

CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id        UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  kpi_value_id  UUID REFERENCES kpi_values(id) ON DELETE SET NULL,
  -- Relacion con meta expirada (migracion 20250621000001_archive)
  kpi_target_id UUID REFERENCES kpi_targets(id) ON DELETE SET NULL,
  hotel_id      UUID REFERENCES hotels(id) ON DELETE SET NULL,
  region_id     UUID REFERENCES regions(id) ON DELETE SET NULL,
  severidad     alert_severity NOT NULL,
  estado        alert_status NOT NULL DEFAULT 'activa',
  mensaje       TEXT NOT NULL,
  escalada      BOOLEAN NOT NULL DEFAULT false,
  escalada_at   TIMESTAMPTZ,
  resuelta_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_kpi_id    ON alerts(kpi_id);
CREATE INDEX idx_alerts_estado    ON alerts(estado);
CREATE INDEX idx_alerts_severidad ON alerts(severidad);
CREATE INDEX IF NOT EXISTS idx_alerts_kpi_target_id ON alerts(kpi_target_id);

-- Indice unico para alertas activas por value (migracion 20250628000003_archive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_kpi_value_open
  ON alerts(kpi_value_id)
  WHERE kpi_value_id IS NOT NULL AND estado IN ('activa', 'escalada');

-- Indice unico para alertas activas por meta (migracion 20250621000001_archive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_target_active
  ON alerts(kpi_target_id)
  WHERE kpi_target_id IS NOT NULL AND estado IN ('activa', 'escalada');

-- =============================================================================
-- HU-KPI-009: Planes de accion
-- =============================================================================

CREATE TABLE action_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id           UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  alert_id         UUID REFERENCES alerts(id) ON DELETE SET NULL,
  titulo           VARCHAR(200) NOT NULL,
  descripcion      TEXT,
  responsable_id   UUID,
  fecha_compromiso DATE NOT NULL,
  estado           action_plan_status NOT NULL DEFAULT 'abierto',
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plans_kpi_id ON action_plans(kpi_id);

CREATE TABLE action_plan_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id   UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  responsable_id   UUID,
  fecha_compromiso DATE,
  completado       BOOLEAN NOT NULL DEFAULT false,
  completado_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plan_items_plan ON action_plan_items(action_plan_id);

-- =============================================================================
-- HU-KPI-012: Auditoria estricta
-- =============================================================================

CREATE TABLE audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  usuario_email  VARCHAR(255),
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  hora           TIME NOT NULL DEFAULT CURRENT_TIME,
  accion         audit_action NOT NULL,
  entidad        VARCHAR(80) NOT NULL,
  entidad_id     UUID,
  valor_anterior JSONB,
  valor_nuevo    JSONB,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_usuario ON audit_logs(usuario_id);
CREATE INDEX idx_audit_logs_entidad ON audit_logs(entidad, entidad_id);
CREATE INDEX idx_audit_logs_fecha   ON audit_logs(fecha);
CREATE INDEX idx_audit_logs_accion  ON audit_logs(accion);

-- =============================================================================
-- Reportes programados (migracion 20250617000001)
-- =============================================================================

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL,
  nombre           VARCHAR(150) NOT NULL DEFAULT 'Reporte semanal',
  filtros          JSONB NOT NULL DEFAULT '{}',
  frecuencia_cron  VARCHAR(50) NOT NULL DEFAULT '0 8 * * 1',
  formato          VARCHAR(20) NOT NULL DEFAULT 'pdf',
  emails           TEXT[] NOT NULL DEFAULT '{}',
  activo           BOOLEAN NOT NULL DEFAULT true,
  ultima_ejecucion TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_activo ON scheduled_reports(activo);

-- =============================================================================
-- MODULO IA: Proveedores, Configuraciones, Modelos y Logs de Uso
-- (migraciones 20260623000001 a 20260624000001 + 20260623000005)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     VARCHAR(50)  NOT NULL UNIQUE,
  nombre     VARCHAR(150) NOT NULL,
  estado     entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE  ai_providers        IS 'Catalogo de proveedores de IA (Gemini, Groq, OpenRouter, etc.)';
COMMENT ON COLUMN ai_providers.codigo IS 'Clave unica del proveedor usada como identificador en el codigo';

-- Nota: sin UNIQUE (provider_id) para permitir multiples configuraciones (migracion 20260624000001)
CREATE TABLE IF NOT EXISTS ai_configurations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  api_key_encrypted BYTEA NOT NULL,
  quota_mensual     INTEGER NOT NULL DEFAULT 1000000,
  modelo_defecto    VARCHAR(100),
  descripcion       TEXT,
  ranking           INTEGER NOT NULL DEFAULT 1,
  estado            entity_status NOT NULL DEFAULT 'activo',
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE  ai_configurations               IS 'Configuraciones por proveedor con API Key cifrada; multiples por proveedor permitidas';
COMMENT ON COLUMN ai_configurations.api_key_encrypted IS 'API Key cifrada con pgp_sym_encrypt usando AI_MASTER_SECRET';
COMMENT ON COLUMN ai_configurations.ranking           IS 'Prioridad de uso: 1 = mayor prioridad';

CREATE INDEX IF NOT EXISTS idx_ai_config_provider_id ON ai_configurations (provider_id);

CREATE TABLE IF NOT EXISTS ai_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  codigo      VARCHAR(100) NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  estado      entity_status NOT NULL DEFAULT 'activo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_id);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id  UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,
  usuario_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  modulo_origen     VARCHAR(100) NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE  ai_usage_logs             IS 'Registro inmutable de consumo de tokens por peticion IA';
COMMENT ON COLUMN ai_usage_logs.modulo_origen IS 'Modulo del sistema que origino la llamada al modelo';

CREATE INDEX IF NOT EXISTS idx_ai_usage_config  ON ai_usage_logs (configuration_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_usuario ON ai_usage_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_modulo  ON ai_usage_logs (modulo_origen);
CREATE INDEX IF NOT EXISTS idx_ai_usage_fecha   ON ai_usage_logs (created_at);

-- =============================================================================
-- FUENTES SQL ESTRUCTURADAS (migracion 20260625000001)
-- =============================================================================

CREATE TABLE IF NOT EXISTS database_connections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             VARCHAR(150) NOT NULL,
  tipo               database_connection_type NOT NULL,
  config             JSONB NOT NULL DEFAULT '{}',
  password_encrypted BYTEA,
  activa             BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE database_connections IS 'Conexiones a Supabase interno o PostgreSQL externo para fuentes SQL';

CREATE INDEX IF NOT EXISTS idx_database_connections_tipo   ON database_connections(tipo);
CREATE INDEX IF NOT EXISTS idx_database_connections_activa ON database_connections(activa);

CREATE TABLE IF NOT EXISTS kpi_sql_sources (
  kpi_id              UUID PRIMARY KEY REFERENCES kpis(id) ON DELETE CASCADE,
  connection_id       UUID NOT NULL REFERENCES database_connections(id) ON DELETE RESTRICT,
  clause_select       TEXT NOT NULL,
  clause_from         TEXT NOT NULL,
  clause_where        TEXT,
  clause_group_by     TEXT,
  clause_having       TEXT,
  clause_order_by     TEXT,
  distinct_rows       BOOLEAN NOT NULL DEFAULT false,
  fecha_column        TEXT NOT NULL DEFAULT 'fecha',
  hotel_column        TEXT,
  variable_column_map JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE kpi_sql_sources IS 'Consulta SQL estructurada por clausulas para cargar variables del KPI';
CREATE INDEX IF NOT EXISTS idx_kpi_sql_sources_connection ON kpi_sql_sources(connection_id);

-- =============================================================================
-- FLUJO DE APROBACIONES (migraciones 20260625500001 + 20260627000001)
-- =============================================================================

CREATE TABLE public.kpi_approval_requests (
  id               UUID NOT NULL DEFAULT gen_random_uuid(),
  kpi_id           UUID NULL,
  solicitante_id   UUID NOT NULL,
  aprobador_id     UUID NULL,
  hotel_id         UUID NOT NULL,
  tipo             request_type NOT NULL,
  estado           approval_status NOT NULL DEFAULT 'pendiente',
  datos_propuestos JSONB NOT NULL,
  observaciones    TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_approval_requests_pkey PRIMARY KEY (id),
  CONSTRAINT fk_approval_solicitante FOREIGN KEY (solicitante_id) REFERENCES public.user_profiles (id),
  CONSTRAINT fk_approval_aprobador   FOREIGN KEY (aprobador_id)   REFERENCES public.user_profiles (id),
  CONSTRAINT fk_approval_hotel       FOREIGN KEY (hotel_id)       REFERENCES public.hotels (id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_kpi         FOREIGN KEY (kpi_id)         REFERENCES public.kpis (id) ON DELETE CASCADE
);

-- =============================================================================
-- ADJUNTOS DE MEDICIONES (migracion 20260628000001 activo)
-- =============================================================================

CREATE TABLE public.kpi_value_attachments (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  kpi_value_id UUID NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  file_url     TEXT NOT NULL,
  uploaded_by  UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_value_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_attachment_kpi_value FOREIGN KEY (kpi_value_id) REFERENCES public.kpi_values (id) ON DELETE CASCADE,
  CONSTRAINT fk_attachment_user      FOREIGN KEY (uploaded_by)  REFERENCES public.user_profiles (id)
);

-- =============================================================================
-- VISTAS
-- =============================================================================

-- Vista semaforizada de valores KPI
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

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('imports',       'imports',       false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars',       'avatars',       true)  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kpi-evidences', 'kpi-evidences', true)  ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SEED: Permisos y Matriz de Roles (version final consolidada)
-- =============================================================================

INSERT INTO permissions (codigo, descripcion, modulo) VALUES
  ('kpis.crear',              'Crear KPIs',                        'kpis'),
  ('kpis.editar',             'Editar KPIs',                       'kpis'),
  ('kpis.inactivar',          'Inactivar KPIs',                    'kpis'),
  ('kpis.ver',                'Ver KPIs (solo lectura)',            'kpis'),
  ('metas.configurar',        'Configurar metas',                  'metas'),
  ('dashboard.ver',           'Ver dashboards',                    'dashboard'),
  ('import.cargar',           'Importar archivos',                 'import'),
  ('integraciones.gestionar', 'Gestionar integraciones',           'integraciones'),
  ('reportes.exportar',       'Exportar reportes',                 'reportes'),
  ('usuarios.gestionar',      'Gestionar usuarios',                'seguridad'),
  ('auditoria.ver',           'Ver bitacora auditoria',            'seguridad'),
  ('catalogo.ver',            'Ver catalogo organizacional',       'catalogo'),
  ('catalogo.gestionar',      'Gestionar catalogo organizacional', 'catalogo'),
  ('alertas.ver',             'Ver alertas',                       'alertas'),
  ('planes.gestionar',        'Gestionar planes de accion',        'alertas')
ON CONFLICT (codigo) DO NOTHING;

-- administrador: todos los permisos
INSERT INTO role_permissions (rol, permission_id)
SELECT 'administrador', id FROM permissions ON CONFLICT DO NOTHING;

-- director_comercial (realineacion final 20250622000001)
INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_comercial', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'kpis.ver', 'reportes.exportar', 'catalogo.ver')
ON CONFLICT DO NOTHING;

-- director_mercadeo
INSERT INTO role_permissions (rol, permission_id)
SELECT 'director_mercadeo', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'kpis.ver', 'reportes.exportar', 'catalogo.ver')
ON CONFLICT DO NOTHING;

-- gerente_hotel (con permisos de aprobacion 20260626000001)
INSERT INTO role_permissions (rol, permission_id)
SELECT 'gerente_hotel', id FROM permissions
WHERE codigo IN (
  'dashboard.ver', 'kpis.ver', 'kpis.crear', 'kpis.editar',
  'metas.configurar', 'import.cargar',
  'reportes.exportar', 'alertas.ver', 'planes.gestionar'
)
ON CONFLICT DO NOTHING;

-- analista (con permisos de aprobacion 20260626000001)
INSERT INTO role_permissions (rol, permission_id)
SELECT 'analista', id FROM permissions
WHERE codigo IN (
  'dashboard.ver', 'kpis.ver', 'kpis.crear', 'kpis.editar',
  'import.cargar', 'integraciones.gestionar',
  'reportes.exportar', 'metas.configurar'
)
ON CONFLICT DO NOTHING;

-- consulta
INSERT INTO role_permissions (rol, permission_id)
SELECT 'consulta', id FROM permissions
WHERE codigo IN ('dashboard.ver', 'kpis.ver', 'reportes.exportar')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DEMO: Datos de demostracion Hoteles Estelar
-- =============================================================================

INSERT INTO regions (id, codigo, nombre) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'AND', 'Region Andina'),
  ('a1000000-0000-4000-8000-000000000002', 'CAR', 'Region Caribe'),
  ('a1000000-0000-4000-8000-000000000003', 'PAC', 'Region Pacifico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO hotels (id, region_id, codigo, nombre, ciudad) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'BOG', 'Estelar Bogota',    'Bogota'),
  ('b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'CTG', 'Estelar Cartagena', 'Cartagena'),
  ('b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'CLO', 'Estelar Cali',      'Cali')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kpi_categories (id, codigo, nombre) VALUES
  ('c3000000-0000-4000-8000-000000000001', 'COM', 'Comercial'),
  ('c3000000-0000-4000-8000-000000000002', 'MKT', 'Mercadeo'),
  ('c3000000-0000-4000-8000-000000000003', 'REV', 'Revenue')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_providers (codigo, nombre, estado) VALUES
  ('google_gemini', 'Google Gemini', 'activo'),
  ('groq',          'Groq',          'activo'),
  ('openrouter',    'OpenRouter',    'activo')
ON CONFLICT (codigo) DO UPDATE SET estado = 'activo';

INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'gemini-1.5-flash',      'Gemini 1.5 Flash'      FROM ai_providers WHERE codigo = 'google_gemini' UNION ALL
SELECT id, 'gemini-1.5-pro',        'Gemini 1.5 Pro'        FROM ai_providers WHERE codigo = 'google_gemini' UNION ALL
SELECT id, 'gemini-2.5-flash',      'Gemini 2.5 Flash'      FROM ai_providers WHERE codigo = 'google_gemini' UNION ALL
SELECT id, 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite' FROM ai_providers WHERE codigo = 'google_gemini'
ON CONFLICT (provider_id, codigo) DO NOTHING;

INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'llama-3.1-8b-instant',    'Llama 3.1 8B Instant (Groq)'    FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile (Groq)' FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'llama3-8b-8192',          'Llama 3 8B (Groq)'               FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'llama3-70b-8192',         'Llama 3 70B (Groq)'              FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'mixtral-8x7b-32768',      'Mixtral 8x7B (Groq)'             FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'gemma2-9b-it',            'Gemma 2 9B (Groq)'               FROM ai_providers WHERE codigo = 'groq'
ON CONFLICT (provider_id, codigo) DO NOTHING;

INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'meta-llama/llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'meta-llama/llama-3.1-8b-instruct',   'Llama 3.1 8B Instruct (OpenRouter)'   FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'google/gemini-2.5-flash',             'Gemini 2.5 Flash (OpenRouter)'        FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'google/gemini-2.5-pro',               'Gemini 2.5 Pro (OpenRouter)'          FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'anthropic/claude-3.5-sonnet',         'Claude 3.5 Sonnet (OpenRouter)'       FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'deepseek/deepseek-chat',              'DeepSeek V3 (OpenRouter)'             FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'meta-llama/llama-3-70b-instruct',     'Llama 3 70B Instruct (OpenRouter)'    FROM ai_providers WHERE codigo = 'openrouter'
ON CONFLICT (provider_id, codigo) DO NOTHING;

INSERT INTO database_connections (id, nombre, tipo, config, activa)
VALUES ('f0000000-0000-4000-8000-000000000001', 'Supabase (proyecto)', 'supabase_internal', '{}', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO external_integrations (id, nombre, sistema_tipo, endpoint_url, auth_config, mapeo_campos, frecuencia_cron, activa)
VALUES (
  'e5000000-0000-4000-8000-000000000001',
  'PMS Estelar Demo', 'pms',
  'https://api.demo-pms.estelar.local/sync',
  '{"tipo": "api_key", "header": "X-API-Key"}',
  '{"ocupacion": "OCP-001", "revpar": "RVP-001"}',
  '0 6 * * *', true
) ON CONFLICT (id) DO NOTHING;
"""

# ===========================================================================
# SCHEMA 2: RLS PERMISSIONS
# ===========================================================================
SCHEMA_RLS = r"""-- =============================================================================
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
"""

# ===========================================================================
# SCHEMA 3: TRIGGERS AND FUNCTIONS
# ===========================================================================
SCHEMA_TRIGGERS = r"""-- =============================================================================
-- KPIS-SYSTEM -- Hoteles Estelar
-- ESQUEMA 3: FUNCIONES, TRIGGERS Y PROCEDIMIENTOS
-- Reconstruido desde todas las migraciones (migrations + migrations_archive)
-- Fecha de consolidacion: 2026-06-25
-- =============================================================================
-- Ejecutar DESPUES de schema_01_tablas.sql
-- Las funciones helper RLS tambien estan en schema_02_rls_permisos.sql
-- para garantizar disponibilidad si se aplica schema_02 sin este.
-- =============================================================================

-- =============================================================================
-- FUNCIONES HELPER RLS (definicion canonica)
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
-- TRIGGER: PERFIL DE USUARIO AUTOMATICO (auth.users)
-- Ultima version: migracion 20250615000003_archive (rol analista por defecto)
-- =============================================================================

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

  -- Rol analista por defecto para acceso completo en dev/demo
  INSERT INTO public.user_roles (user_id, rol)
  VALUES (NEW.id, 'analista');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- FUNCION DE AUDITORIA
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id    UUID;
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
CREATE TRIGGER trg_audit_external_integrations AFTER INSERT OR UPDATE OR DELETE ON external_integrations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_action_plans AFTER INSERT OR UPDATE OR DELETE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_ai_configurations AFTER INSERT OR UPDATE OR DELETE ON ai_configurations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Inmutabilidad de audit_logs
CREATE OR REPLACE FUNCTION fn_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es inmutable: operacion % prohibida', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable();

-- Helper RPC para atribucion de usuario en auditoria (migracion 20250624000001)
CREATE OR REPLACE FUNCTION set_audit_user_context(p_user_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    PERFORM set_config('app.current_user_id', '', true);
  ELSE
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_audit_user_context(UUID) TO authenticated, service_role;

-- =============================================================================
-- CALCULO AUTOMATICO DE CUMPLIMIENTO Y SEMAFORO
-- =============================================================================

-- Calcula semaforo para un valor KPI dado
CREATE OR REPLACE FUNCTION fn_calc_semaforo(
  p_kpi_id          UUID,
  p_fecha           DATE,
  p_cumplimiento_pct NUMERIC
) RETURNS traffic_light_status AS $$
DECLARE
  v_cumplimiento_min NUMERIC;
  v_riesgo_min       NUMERIC;
  v_riesgo_max       NUMERIC;
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
  v_riesgo_min       := COALESCE(v_riesgo_min, 80);
  v_riesgo_max       := COALESCE(v_riesgo_max, 99.99);

  IF p_cumplimiento_pct >= v_cumplimiento_min THEN
    RETURN 'cumplimiento';
  ELSIF p_cumplimiento_pct BETWEEN v_riesgo_min AND v_riesgo_max THEN
    RETURN 'riesgo';
  ELSE
    RETURN 'incumplimiento';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- BEFORE INSERT/UPDATE: calcula cumplimiento_pct
CREATE OR REPLACE FUNCTION fn_kpi_values_calc_cumplimiento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valor_meta IS NOT NULL AND NEW.valor_meta <> 0 THEN
    NEW.cumplimiento_pct := ROUND((NEW.valor_real / NEW.valor_meta) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kpi_values_calc ON kpi_values;
CREATE TRIGGER trg_kpi_values_calc
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_calc_cumplimiento();

-- BEFORE INSERT/UPDATE: asigna semaforo calculado
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

-- =============================================================================
-- GENERACION AUTOMATICA DE ALERTAS (HU-KPI-008)
-- Version final: migracion 20250628000006_archive
-- (Evita recrear alertas para un kpi_value que ya tuvo alerta, incluyendo resueltas)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo    traffic_light_status;
  v_kpi_nombre  VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad   alert_severity;
  v_mensaje     TEXT;
  v_existe      BOOLEAN;
  v_estado      alert_status;
  v_escalada    BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  -- Evitar recrear si ya existe alguna alerta (incluyendo resueltas)
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
    v_estado    := 'escalada';
    v_escalada  := true;
  ELSE
    v_severidad := 'riesgo';
    v_estado    := 'activa';
    v_escalada  := false;
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' - ' || v_hotel_nombre ELSE '' END,
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

DROP TRIGGER IF EXISTS trg_kpi_values_create_alert ON kpi_values;
CREATE TRIGGER trg_kpi_values_create_alert
  AFTER INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_create_alert();

-- =============================================================================
-- INMUTABILIDAD DE ai_usage_logs
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ai_usage_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_usage_logs es inmutable: operacion % no permitida', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_usage_logs_immutable ON ai_usage_logs;
CREATE TRIGGER trg_ai_usage_logs_immutable
  BEFORE UPDATE OR DELETE ON ai_usage_logs
  FOR EACH ROW EXECUTE FUNCTION fn_ai_usage_logs_immutable();

-- =============================================================================
-- FUNCIONES DE SINCRONIZACION Y UTILIDAD
-- =============================================================================

-- Escalamiento automatico de alertas sin plan tras 48h (migracion 20250617000001_archive)
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
    estado     = 'escalada',
    escalada   = true,
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

-- Alertas por valor KPI (backfill/sincronizacion) (migracion 20250628000006_archive)
-- Evita recrear alertas ya existentes (incluyendo resueltas)
CREATE OR REPLACE FUNCTION fn_sync_kpi_value_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count        INTEGER := 0;
  r              RECORD;
  v_hotel_nombre VARCHAR(150);
  v_severidad    alert_severity;
  v_estado       alert_status;
  v_escalada     BOOLEAN;
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
      v_estado    := 'escalada';
      v_escalada  := true;
    ELSE
      v_severidad := 'riesgo';
      v_estado    := 'activa';
      v_escalada  := false;
    END IF;

    INSERT INTO alerts (
      kpi_id, kpi_value_id, hotel_id, region_id,
      severidad, estado, mensaje, escalada, escalada_at
    ) VALUES (
      r.kpi_id, r.id, r.hotel_id, r.region_id,
      v_severidad, v_estado,
      format(
        'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
        r.kpi_nombre,
        r.semaforo_calc,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' - ' || v_hotel_nombre ELSE '' END,
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

-- Alertas por metas finalizadas (migracion 20250621000001_archive)
CREATE OR REPLACE FUNCTION fn_sync_expired_target_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count        INTEGER := 0;
  r              RECORD;
  v_hotel_nombre VARCHAR(150);
BEGIN
  FOR r IN
    SELECT
      t.id, t.kpi_id, t.hotel_id, t.region_id,
      t.fecha_inicio, t.fecha_fin, t.valor_meta, t.periodo_tipo,
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
      r.kpi_id, r.id, r.hotel_id, r.region_id,
      'riesgo', 'activa',
      format(
        'Meta finalizada: KPI "%s" - periodo %s (%s a %s)%s. Valor meta: %s.',
        r.kpi_nombre, r.periodo_tipo, r.fecha_inicio, r.fecha_fin,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' - ' || v_hotel_nombre ELSE '' END,
        r.valor_meta
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sync_expired_target_alerts() TO authenticated;

-- =============================================================================
-- FUNCIONES RPC MODULO IA
-- =============================================================================

-- get_active_ai_api_key: version final con ranking y p_master_secret como parametro
-- (migracion 20260624000001)
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT);
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_active_ai_api_key(
  p_provider      TEXT DEFAULT NULL,
  p_master_secret TEXT DEFAULT NULL
)
RETURNS TABLE (
  api_key          TEXT,
  configuration_id UUID,
  provider_code    TEXT,
  modelo_defecto   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_master_secret IS NULL OR p_master_secret = '' THEN
    RAISE EXCEPTION 'AI_MASTER_SECRET no configurado o no enviado como parametro';
  END IF;

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(ac.api_key_encrypted, p_master_secret)::TEXT AS api_key,
    ac.id AS configuration_id,
    ap.codigo::TEXT AS provider_code,
    ac.modelo_defecto::TEXT AS modelo_defecto
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  WHERE (p_provider IS NULL OR ap.codigo = p_provider)
    AND ac.estado = 'activo'
    AND ap.estado = 'activo'
  ORDER BY ac.ranking ASC, ac.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_active_ai_api_key(TEXT, TEXT) IS
  'Retorna la API Key descifrada del proveedor IA activo. '
  'Si p_provider es NULL retorna el de mayor prioridad (ranking). '
  'Usar solo desde service_role.';

REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION get_active_ai_api_key(TEXT, TEXT) TO service_role;

-- upsert_ai_configuration_with_key: version final con ranking y multiples configuraciones
-- (migracion 20260624000001)
DROP FUNCTION IF EXISTS upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION upsert_ai_configuration_with_key(
  p_configuration_id     UUID,
  p_provider_id          UUID,
  p_api_key_plain        TEXT,
  p_master_secret        TEXT,
  p_modelo_defecto       TEXT,
  p_cuota_mensual_tokens INTEGER,
  p_descripcion          TEXT,
  p_ranking              INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_configuration_id IS NOT NULL THEN
    v_id := p_configuration_id;

    UPDATE ai_configurations
    SET
      provider_id    = p_provider_id,
      quota_mensual  = p_cuota_mensual_tokens,
      modelo_defecto = p_modelo_defecto,
      ranking        = p_ranking,
      descripcion    = p_descripcion,
      updated_at     = now()
    WHERE id = v_id;

    IF p_api_key_plain IS NOT NULL AND p_api_key_plain <> '' THEN
      UPDATE ai_configurations
      SET api_key_encrypted = pgp_sym_encrypt(p_api_key_plain, p_master_secret)
      WHERE id = v_id;
    END IF;
  ELSE
    INSERT INTO ai_configurations (
      provider_id, api_key_encrypted, quota_mensual,
      modelo_defecto, ranking, descripcion, estado
    ) VALUES (
      p_provider_id,
      pgp_sym_encrypt(p_api_key_plain, p_master_secret),
      p_cuota_mensual_tokens,
      p_modelo_defecto,
      p_ranking,
      p_descripcion,
      'activo'
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION upsert_ai_configuration_with_key IS
  'Crea o actualiza una configuracion IA cifrando la API Key. '
  'Permite multiples configuraciones por proveedor con ranking de prioridad. '
  'Solo ejecutable desde service_role.';

REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM authenticated;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

-- list_ai_configurations_masked: listado con clave enmascarada (migracion 20260624000001)
DROP FUNCTION IF EXISTS list_ai_configurations_masked();

CREATE OR REPLACE FUNCTION list_ai_configurations_masked()
RETURNS TABLE (
  id                   UUID,
  provider_id          UUID,
  provider_nombre      TEXT,
  provider_proveedor   TEXT,
  modelo_defecto       TEXT,
  cuota_mensual_tokens INTEGER,
  estado               entity_status,
  descripcion          TEXT,
  api_key_masked       TEXT,
  created_at           TIMESTAMPTZ,
  ranking              INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.provider_id,
    ap.nombre::TEXT AS provider_nombre,
    ap.codigo::TEXT AS provider_proveedor,
    ac.modelo_defecto::TEXT AS modelo_defecto,
    ac.quota_mensual AS cuota_mensual_tokens,
    ac.estado,
    ac.descripcion::TEXT AS descripcion,
    ('########' || right(encode(ac.api_key_encrypted, 'hex'), 4))::TEXT AS api_key_masked,
    ac.created_at,
    ac.ranking
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  ORDER BY ac.ranking ASC, ac.created_at DESC;
END;
$$;

COMMENT ON FUNCTION list_ai_configurations_masked IS
  'Lista las configuraciones de IA con la clave enmascarada y en orden de prioridad. '
  'Usar desde backend.';

GRANT EXECUTE ON FUNCTION list_ai_configurations_masked() TO service_role;
"""

# Write files
files = {
    "schema_01_tablas.sql":          SCHEMA_TABLAS,
    "schema_02_rls_permisos.sql":    SCHEMA_RLS,
    "schema_03_triggers_funciones.sql": SCHEMA_TRIGGERS,
}

for filename, content in files.items():
    path = os.path.join(BASE, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.lstrip('\n'))
    size = os.path.getsize(path)
    print(f"Created: {filename} ({size:,} bytes)")

print("\nDone! 3 schema files created.")

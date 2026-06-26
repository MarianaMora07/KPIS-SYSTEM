-- =============================================================================
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

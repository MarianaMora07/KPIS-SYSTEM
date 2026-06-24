-- =============================================================================
-- KPIs System — Fuentes SQL estructuradas y conexiones de base de datos
-- Migración: 20260625000001_sql_data_sources.sql
-- =============================================================================

-- Extender enum de integraciones
ALTER TYPE integration_system_type ADD VALUE IF NOT EXISTS 'sql_database';

-- Tipo de conexión
DO $$ BEGIN
  CREATE TYPE database_connection_type AS ENUM ('supabase_internal', 'postgres_external');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Conexiones de base de datos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS database_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(150) NOT NULL,
  tipo                database_connection_type NOT NULL,
  config              JSONB NOT NULL DEFAULT '{}',
  password_encrypted  BYTEA,
  activa              BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE database_connections IS 'Conexiones a Supabase interno o PostgreSQL externo para fuentes SQL';
COMMENT ON COLUMN database_connections.config IS 'Host, puerto, database, user, ssl (sin contraseña)';
COMMENT ON COLUMN database_connections.password_encrypted IS 'Contraseña cifrada (solo postgres_external)';

CREATE INDEX IF NOT EXISTS idx_database_connections_tipo ON database_connections(tipo);
CREATE INDEX IF NOT EXISTS idx_database_connections_activa ON database_connections(activa);

-- ---------------------------------------------------------------------------
-- Fuente SQL estructurada por KPI (1:1 opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_sql_sources (
  kpi_id                UUID PRIMARY KEY REFERENCES kpis(id) ON DELETE CASCADE,
  connection_id         UUID NOT NULL REFERENCES database_connections(id) ON DELETE RESTRICT,
  clause_select         TEXT NOT NULL,
  clause_from           TEXT NOT NULL,
  clause_where          TEXT,
  clause_group_by       TEXT,
  clause_having         TEXT,
  clause_order_by       TEXT,
  distinct_rows         BOOLEAN NOT NULL DEFAULT false,
  fecha_column          TEXT NOT NULL DEFAULT 'fecha',
  hotel_column          TEXT,
  variable_column_map   JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kpi_sql_sources IS 'Consulta SQL estructurada por cláusulas para cargar variables del KPI';
CREATE INDEX IF NOT EXISTS idx_kpi_sql_sources_connection ON kpi_sql_sources(connection_id);

-- Conexión interna por defecto
INSERT INTO database_connections (id, nombre, tipo, config, activa)
VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'Supabase (proyecto)',
  'supabase_internal',
  '{}',
  true
)
ON CONFLICT (id) DO NOTHING;

-- RLS
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

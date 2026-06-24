-- =============================================================================
-- Módulo de Inteligencia Artificial - Estelar KPIs
-- Tablas: Proveedores, Configuraciones (Keys encriptadas) y Logs de Uso
-- =============================================================================

-- 1. Tabla de Proveedores de IA (Catálogo)
CREATE TABLE ai_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(50) NOT NULL UNIQUE,
  nombre        VARCHAR(150) NOT NULL,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de Configuraciones (Donde se guarda la API Key cifrada y la cuota)
CREATE TABLE ai_configurations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  api_key_encrypted BYTEA NOT NULL, -- Se guarda en binario por el cifrado
  quota_mensual     INTEGER NOT NULL DEFAULT 1000000, -- Límite de tokens
  estado            entity_status NOT NULL DEFAULT 'activo',
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id) -- Solo una configuración activa por proveedor
);

-- 3. Tabla de Bitácora de Uso (Consumo de Tokens)
CREATE TABLE ai_usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id  UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,
  usuario_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  modulo_origen     VARCHAR(100) NOT NULL, -- Ej. 'sugerencias_kpi', 'analisis_tendencia'
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_logs_usuario ON ai_usage_logs(usuario_id);
CREATE INDEX idx_ai_usage_logs_config ON ai_usage_logs(configuration_id);

-- =============================================================================
-- SEGURIDAD (Row Level Security - RLS)
-- =============================================================================

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Proveedores: Todos pueden leer el catálogo, solo admin gestiona
CREATE POLICY ai_providers_select ON ai_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_providers_manage ON ai_providers FOR ALL USING (fn_current_user_role() = 'administrador');

-- Configuraciones (API Keys): SOLO el administrador tiene acceso a esta tabla
CREATE POLICY ai_configurations_manage ON ai_configurations FOR ALL USING (fn_current_user_role() = 'administrador');

-- Logs de uso: Cualquier usuario autenticado puede INYECTAR logs cuando usa la IA, 
-- pero SOLO el administrador puede LEER la tabla para las gráficas.
CREATE POLICY ai_usage_logs_insert ON ai_usage_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ai_usage_logs_select ON ai_usage_logs FOR SELECT USING (fn_current_user_role() = 'administrador');

-- =============================================================================
-- INTEGRACIÓN CON LA AUDITORÍA DE MARIANA
-- =============================================================================

-- Enlazamos la tabla de configuraciones al trigger de auditoría inmutable
CREATE TRIGGER trg_audit_ai_configurations
  AFTER INSERT OR UPDATE OR DELETE ON ai_configurations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- =============================================================================
-- DATOS SEMILLA (SEED)
-- =============================================================================

INSERT INTO ai_providers (codigo, nombre) VALUES 
  ('google_gemini', 'Google Gemini'),
  ('openai', 'OpenAI (ChatGPT)'),
  ('anthropic', 'Anthropic (Claude)')
ON CONFLICT (codigo) DO NOTHING;
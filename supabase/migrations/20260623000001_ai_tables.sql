-- =============================================================================
-- KPIs System — IA: Proveedores, Configuraciones Cifradas y Bitácora de Uso
-- Migración: 20260623000001_ai_tables.sql
-- Requiere: pgcrypto (ya activo), variable de entorno AI_MASTER_SECRET
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLA: ai_providers
-- Catálogo de proveedores de IA disponibles en el sistema
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(50)  NOT NULL UNIQUE,   -- ej. 'google_gemini'
  nombre      VARCHAR(150) NOT NULL,
  estado      entity_status NOT NULL DEFAULT 'activo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  ai_providers        IS 'Catálogo de proveedores de IA (Gemini, OpenAI, etc.)';
COMMENT ON COLUMN ai_providers.codigo IS 'Clave única del proveedor, usada como identificador en el código';

-- ---------------------------------------------------------------------------
-- TABLA: ai_configurations
-- Almacena la configuración activa de cada proveedor, con la API Key cifrada
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_configurations (
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

COMMENT ON TABLE  ai_configurations                IS 'Configuración por proveedor; máximo una activa por proveedor';
COMMENT ON COLUMN ai_configurations.api_key_encrypted IS 'API Key cifrada con pgp_sym_encrypt usando AI_MASTER_SECRET';

CREATE INDEX IF NOT EXISTS idx_ai_config_provider_id
  ON ai_configurations (provider_id);

-- ---------------------------------------------------------------------------
-- TABLA: ai_usage_logs
-- Bitácora de consumo de tokens por llamada al modelo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id  UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,
  usuario_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  modulo_origen     VARCHAR(100) NOT NULL, -- Ej. 'sugerencias_kpi', 'analisis_tendencia'
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  ai_usage_logs                IS 'Registro inmutable de consumo de tokens por petición IA';
COMMENT ON COLUMN ai_usage_logs.modulo_origen  IS 'Módulo del sistema que originó la llamada al modelo';
COMMENT ON COLUMN ai_usage_logs.prompt_tokens  IS 'promptTokenCount devuelto por la API del modelo';
COMMENT ON COLUMN ai_usage_logs.completion_tokens IS 'candidatesTokenCount devuelto por la API del modelo';
COMMENT ON COLUMN ai_usage_logs.total_tokens   IS 'totalTokenCount devuelto por la API del modelo';

CREATE INDEX IF NOT EXISTS idx_ai_usage_config    ON ai_usage_logs (configuration_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_usuario   ON ai_usage_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_modulo    ON ai_usage_logs (modulo_origen);
CREATE INDEX IF NOT EXISTS idx_ai_usage_fecha     ON ai_usage_logs (created_at);

-- Inmutabilidad: la bitácora de tokens no se puede editar ni borrar
CREATE OR REPLACE FUNCTION fn_ai_usage_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_usage_logs es inmutable: operación % no permitida', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_usage_logs_immutable
  BEFORE UPDATE OR DELETE ON ai_usage_logs
  FOR EACH ROW EXECUTE FUNCTION fn_ai_usage_logs_immutable();

-- ---------------------------------------------------------------------------
-- RLS — Seguridad por fila
-- ---------------------------------------------------------------------------

-- ai_providers: lectura pública para usuarios autenticados, escritura solo admin
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_providers_select ON ai_providers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY ai_providers_insert ON ai_providers
  FOR INSERT TO authenticated
  WITH CHECK (fn_current_user_role() = 'administrador');

CREATE POLICY ai_providers_update ON ai_providers
  FOR UPDATE TO authenticated
  USING (fn_current_user_role() = 'administrador');

-- ai_configurations: NINGÚN usuario autenticado puede leer las llaves
-- Solo service_role (backend) puede acceder vía RPC SECURITY DEFINER
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_configurations_deny_all ON ai_configurations
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false);

-- ai_usage_logs: lectura y escritura controlada
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_logs_select ON ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    fn_current_user_role() IN ('administrador', 'analista')
    OR usuario_id = auth.uid()
  );

CREATE POLICY ai_usage_logs_insert ON ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);   -- El backend inserta en nombre del usuario autenticado

-- ---------------------------------------------------------------------------
-- FUNCIÓN RPC: get_active_ai_api_key
-- Puente seguro de descifrado — solo ejecutable desde backend (service_role)
-- Retorna la API Key en texto plano y el configuration_id del proveedor activo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_active_ai_api_key(p_provider TEXT)
RETURNS TABLE (
  api_key          TEXT,
  configuration_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_secret TEXT;
BEGIN
  -- Leer el secreto maestro desde la configuración de sesión
  -- En Supabase, se inyecta vía: SET app.ai_master_secret = '...'
  -- o bien desde un Vault secret. Aquí lo leemos desde la variable de entorno
  -- que el backend debe haber establecido antes de llamar.
  v_master_secret := NULLIF(current_setting('app.ai_master_secret', true), '');

  IF v_master_secret IS NULL THEN
    RAISE EXCEPTION 'AI_MASTER_SECRET no configurado en la sesión de base de datos (app.ai_master_secret)';
  END IF;

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(ac.api_key_encrypted, v_master_secret)::TEXT AS api_key,
    ac.id AS configuration_id
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  WHERE ap.codigo = p_provider
    AND ac.estado = 'activo'
    AND ap.estado = 'activo'
  ORDER BY ac.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_active_ai_api_key IS
  'Retorna la API Key descifrada y el configuration_id del proveedor IA activo. '
  'Requiere que app.ai_master_secret esté configurado en la sesión. '
  'Usar solo desde service_role (SECURITY DEFINER).';

-- Revocar acceso público directo a la función
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION get_active_ai_api_key(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- SEED: Proveedor inicial google_gemini
-- ---------------------------------------------------------------------------
INSERT INTO ai_providers (nombre, codigo, estado)
VALUES (
  'Google Gemini',
  'google_gemini',
  'activo'
)
ON CONFLICT (codigo) DO NOTHING;

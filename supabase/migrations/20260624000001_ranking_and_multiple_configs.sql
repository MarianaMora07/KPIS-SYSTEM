-- =============================================================================
-- KPIs System — IA: Múltiples configuraciones por proveedor, descripción, ranking y borrado
-- Migración: 20260624000001_ranking_and_multiple_configs.sql
-- =============================================================================

-- 1. Eliminar la restricción de unicidad para permitir múltiples configuraciones del mismo proveedor
ALTER TABLE ai_configurations DROP CONSTRAINT IF EXISTS ai_configurations_provider_id_key;

-- 2. Agregar columna descripcion si no existía y la columna ranking de uso (prioridad)
ALTER TABLE ai_configurations ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE ai_configurations ADD COLUMN IF NOT EXISTS ranking INTEGER NOT NULL DEFAULT 1;

-- 3. Inactivar o remover proveedores que no sean google_gemini, groq, openrouter
UPDATE ai_providers 
SET estado = 'inactivo' 
WHERE codigo NOT IN ('google_gemini', 'groq', 'openrouter');

-- 4. Actualizar get_active_ai_api_key para ordenar por ranking ASC y created_at DESC
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_active_ai_api_key(
  p_provider TEXT DEFAULT NULL,
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
    RAISE EXCEPTION 'AI_MASTER_SECRET no configurado o no enviado como parámetro';
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
  'Retorna la API Key descifrada, el configuration_id, el código del proveedor y el modelo por defecto del proveedor IA activo. '
  'Si p_provider es NULL, retorna el más recientemente configurado como activo, ordenado por ranking. '
  'Recibe p_master_secret directamente como parámetro para descifrar la clave. '
  'Usar solo desde service_role (SECURITY DEFINER).';

GRANT EXECUTE ON FUNCTION get_active_ai_api_key(TEXT, TEXT) TO service_role;

-- 5. Actualizar list_ai_configurations_masked para incluir la descripción, el ranking y ordenar por ranking
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
    ('••••••••••••' || right(encode(ac.api_key_encrypted, 'hex'), 4))::TEXT AS api_key_masked,
    ac.created_at,
    ac.ranking
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  ORDER BY ac.ranking ASC, ac.created_at DESC;
END;
$$;

COMMENT ON FUNCTION list_ai_configurations_masked IS
  'Lista las configuraciones de IA con la clave enmascarada y en orden de prioridad (ranking). '
  'Usar desde backend.';

GRANT EXECUTE ON FUNCTION list_ai_configurations_masked() TO service_role;

-- 6. Actualizar upsert_ai_configuration_with_key para aceptar el parámetro de ranking y descripción, y no forzar update por proveedor
DROP FUNCTION IF EXISTS upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION upsert_ai_configuration_with_key(
  p_configuration_id   UUID,
  p_provider_id        UUID,
  p_api_key_plain      TEXT,
  p_master_secret      TEXT,
  p_modelo_defecto     TEXT,
  p_cuota_mensual_tokens INTEGER,
  p_descripcion        TEXT,
  p_ranking            INTEGER DEFAULT 1
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
    
    -- UPDATE existente
    UPDATE ai_configurations
    SET
      provider_id          = p_provider_id,
      quota_mensual        = p_cuota_mensual_tokens,
      modelo_defecto       = p_modelo_defecto,
      ranking              = p_ranking,
      descripcion          = p_descripcion,
      updated_at           = now()
    WHERE id = v_id;

    -- Si se envió una nueva key, la actualizamos cifrada
    IF p_api_key_plain IS NOT NULL AND p_api_key_plain <> '' THEN
      UPDATE ai_configurations
      SET api_key_encrypted = pgp_sym_encrypt(p_api_key_plain, p_master_secret)
      WHERE id = v_id;
    END IF;
  ELSE
    -- INSERT nuevo (siempre inserta si p_configuration_id es nulo para permitir múltiples)
    INSERT INTO ai_configurations (
      provider_id,
      api_key_encrypted,
      quota_mensual,
      modelo_defecto,
      ranking,
      descripcion,
      estado
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
  'Crea o actualiza una configuración IA de forma segura, permitiendo múltiples configuraciones por proveedor y manejando el ranking de prioridad.';

GRANT EXECUTE ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

-- =============================================================================
-- KPIs System — IA: Guardar Modelo por Defecto y Habilitar pgcrypto
-- Migración: 20260623000004_add_modelo_defecto.sql
-- =============================================================================

-- 1. Habilitar la extensión pgcrypto (necesaria para cifrado/descifrado pgp_sym)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Agregar columna modelo_defecto a la tabla ai_configurations
ALTER TABLE ai_configurations 
  ADD COLUMN IF NOT EXISTS modelo_defecto VARCHAR(100);

COMMENT ON COLUMN ai_configurations.modelo_defecto IS 'Identificador técnico del modelo por defecto configurado para el proveedor';

-- 3. Actualizar la función upsert_ai_configuration_with_key incluyendo extensions en search_path
CREATE OR REPLACE FUNCTION upsert_ai_configuration_with_key(
  p_configuration_id   UUID,
  p_provider_id        UUID,
  p_api_key_plain      TEXT,
  p_master_secret      TEXT,
  p_modelo_defecto     TEXT,
  p_cuota_mensual_tokens INTEGER,
  p_descripcion        TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_configuration_id IS NULL THEN
    -- INSERT
    INSERT INTO ai_configurations (
      provider_id,
      api_key_encrypted,
      quota_mensual,
      modelo_defecto,
      estado
    ) VALUES (
      p_provider_id,
      pgp_sym_encrypt(p_api_key_plain, p_master_secret),
      p_cuota_mensual_tokens,
      p_modelo_defecto,
      'activo'
    )
    RETURNING id INTO v_id;
  ELSE
    -- UPDATE con nueva key
    UPDATE ai_configurations
    SET
      provider_id          = p_provider_id,
      api_key_encrypted    = pgp_sym_encrypt(p_api_key_plain, p_master_secret),
      quota_mensual        = p_cuota_mensual_tokens,
      modelo_defecto       = p_modelo_defecto,
      updated_at           = now()
    WHERE id = p_configuration_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION upsert_ai_configuration_with_key IS
  'Crea o actualiza una configuración IA cifrando la API Key con pgp_sym_encrypt y guardando el modelo por defecto. '
  'Solo ejecutable desde service_role.';

-- Revocar acceso público
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

-- 4. Actualizar la función get_active_ai_api_key incluyendo extensions en search_path y pasando p_master_secret directamente
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT);

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
  ORDER BY ac.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_active_ai_api_key(TEXT, TEXT) IS
  'Retorna la API Key descifrada, el configuration_id, el código del proveedor y el modelo por defecto del proveedor IA activo. '
  'Si p_provider es NULL, retorna el más recientemente configurado como activo. '
  'Recibe p_master_secret directamente como parámetro para descifrar la clave. '
  'Usar solo desde service_role (SECURITY DEFINER).';

-- Revocar acceso público directo a la función
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION get_active_ai_api_key(TEXT, TEXT) TO service_role;

-- =============================================================================
-- KPIs System — IA: Universal Router RPC Update
-- Migración: 20260623000003_ai_universal_router.sql
-- =============================================================================

-- Drop the old function because return type (table columns) changes
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT);

CREATE OR REPLACE FUNCTION get_active_ai_api_key(p_provider TEXT DEFAULT NULL)
RETURNS TABLE (
  api_key          TEXT,
  configuration_id UUID,
  provider_code    TEXT,
  modelo_defecto   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_secret TEXT;
BEGIN
  -- Leer el secreto maestro desde la configuración de sesión
  v_master_secret := NULLIF(current_setting('app.ai_master_secret', true), '');

  IF v_master_secret IS NULL THEN
    RAISE EXCEPTION 'AI_MASTER_SECRET no configurado en la sesión de base de datos (app.ai_master_secret)';
  END IF;

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(ac.api_key_encrypted, v_master_secret)::TEXT AS api_key,
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

COMMENT ON FUNCTION get_active_ai_api_key IS
  'Retorna la API Key descifrada, el configuration_id, el código del proveedor y el modelo por defecto del proveedor IA activo. '
  'Si p_provider es NULL, retorna el más recientemente configurado como activo. '
  'Requiere que app.ai_master_secret esté configurado en la sesión. '
  'Usar solo desde service_role (SECURITY DEFINER).';

-- Revocar acceso público directo a la función
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION get_active_ai_api_key(TEXT) TO service_role;

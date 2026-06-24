-- =============================================================================
-- KPIs System — IA: Corrección de Esquema en RPC Unificado
-- =============================================================================

DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_active_ai_api_key(
  p_provider TEXT DEFAULT NULL,
  p_master_secret TEXT DEFAULT NULL
)
RETURNS TABLE (
  api_key TEXT,
  configuration_id UUID,
  provider_code TEXT,
  modelo_defecto TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_master_secret IS NULL THEN
    RAISE EXCEPTION 'AI_MASTER_SECRET no puede ser nulo para descifrar las credenciales';
  END IF;

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(ac.api_key_encrypted, p_master_secret)::TEXT AS api_key,
    ac.id AS configuration_id,
    ap.codigo::TEXT AS provider_code, -- Corregido: ap.codigo en lugar de ap.proveedor
    ac.modelo_defecto::TEXT AS modelo_defecto
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  WHERE (p_provider IS NULL OR ap.codigo = p_provider) -- Corregido: ap.codigo en lugar de ap.proveedor
    AND ac.estado = 'activo'::entity_status
    AND ap.estado = 'activo'::entity_status
  ORDER BY ac.created_at DESC
  LIMIT 1;
END;
$$;

-- Asegurar permisos correctos para el backend
GRANT EXECUTE ON FUNCTION get_active_ai_api_key(TEXT, TEXT) TO service_role;

ALTER FUNCTION get_active_ai_api_key(TEXT, TEXT) SET search_path = public, extensions;

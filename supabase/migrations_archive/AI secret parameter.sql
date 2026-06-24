CREATE OR REPLACE FUNCTION get_active_ai_api_key(p_provider TEXT DEFAULT NULL, p_master_secret TEXT DEFAULT NULL)
RETURNS TABLE (api_key TEXT, configuration_id UUID, provider_code TEXT, modelo_defecto TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pgp_sym_decrypt(ac.api_key_encrypted, p_master_secret)::TEXT AS api_key,
    ac.id AS configuration_id,
    ap.proveedor::TEXT AS provider_code,
    ac.modelo_defecto::TEXT AS modelo_defecto
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  WHERE (p_provider IS NULL OR ap.proveedor = p_provider)
    AND ac.estado = 'activo' AND ap.estado = 'activo'
  LIMIT 1;
END;
$$;
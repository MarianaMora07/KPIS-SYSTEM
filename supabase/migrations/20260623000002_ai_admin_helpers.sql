-- =============================================================================
-- KPIs System — IA: Admin UI Helpers
-- Migración: 20260623000002_ai_admin_helpers.sql
-- Añade: cuota_mensual_tokens a ai_configurations
--        RPC upsert_ai_configuration_with_key (cifrado en servidor)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Añadir columna cuota_mensual_tokens a ai_configurations
-- (si ya existe no hace nada)
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- RPC: upsert_ai_configuration_with_key
-- Inserta o actualiza una configuración cifrando la API Key con pgp_sym_encrypt.
-- Solo ejecutable desde service_role (backend); nunca recibe la key en texto
-- plano desde el cliente.
-- ---------------------------------------------------------------------------
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
SET search_path = public
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
      estado
    ) VALUES (
      p_provider_id,
      pgp_sym_encrypt(p_api_key_plain, p_master_secret),
      p_cuota_mensual_tokens,
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
      updated_at           = now()
    WHERE id = p_configuration_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION upsert_ai_configuration_with_key IS
  'Crea o actualiza una configuración IA cifrando la API Key con pgp_sym_encrypt. '
  'Solo ejecutable desde service_role.';

-- Revocar acceso público
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

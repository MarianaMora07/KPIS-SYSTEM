-- =============================================================================
-- KPIs System — IA: Corregir Upsert de Configuración para evitar conflicto de clave duplicada
-- Migración: 20260623000006_fix_upsert_conflict.sql
-- =============================================================================

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
  -- Si no se provee ID, primero intentamos encontrar una configuración existente para este proveedor
  IF p_configuration_id IS NULL THEN
    SELECT id INTO v_id 
    FROM ai_configurations 
    WHERE provider_id = p_provider_id;
  ELSE
    v_id := p_configuration_id;
  END IF;

  IF v_id IS NOT NULL THEN
    -- UPDATE existente
    UPDATE ai_configurations
    SET
      provider_id          = p_provider_id,
      quota_mensual        = p_cuota_mensual_tokens,
      modelo_defecto       = p_modelo_defecto,
      updated_at           = now()
    WHERE id = v_id;

    -- Si se envió una nueva key, la actualizamos cifrada
    IF p_api_key_plain IS NOT NULL AND p_api_key_plain <> '' THEN
      UPDATE ai_configurations
      SET api_key_encrypted = pgp_sym_encrypt(p_api_key_plain, p_master_secret)
      WHERE id = v_id;
    END IF;
  ELSE
    -- INSERT nuevo
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
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION upsert_ai_configuration_with_key IS
  'Crea o actualiza una configuración IA de forma segura, manejando conflictos de proveedor único para evitar violaciones de clave única.';

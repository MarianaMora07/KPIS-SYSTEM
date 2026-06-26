-- =============================================================================
-- KPIS-SYSTEM -- Hoteles Estelar
-- ESQUEMA 3: FUNCIONES, TRIGGERS Y PROCEDIMIENTOS
-- Reconstruido desde todas las migraciones (migrations + migrations_archive)
-- Fecha de consolidacion: 2026-06-25
-- =============================================================================
-- Ejecutar DESPUES de schema_01_tablas.sql
-- Las funciones helper RLS tambien estan en schema_02_rls_permisos.sql
-- para garantizar disponibilidad si se aplica schema_02 sin este.
-- =============================================================================

-- =============================================================================
-- FUNCIONES HELPER RLS (definicion canonica)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_current_user_role()
RETURNS app_role AS $$
  SELECT ur.rol FROM user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_has_full_access()
RETURNS BOOLEAN AS $$
  SELECT fn_current_user_role() IN (
    'administrador', 'director_comercial', 'director_mercadeo', 'analista'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_can_access_hotel(p_hotel_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    fn_user_has_full_access()
    OR EXISTS (SELECT 1 FROM user_hotel_scopes WHERE user_id = auth.uid() AND hotel_id = p_hotel_id)
    OR EXISTS (
      SELECT 1 FROM user_region_scopes urs
      JOIN hotels h ON h.region_id = urs.region_id
      WHERE urs.user_id = auth.uid() AND h.id = p_hotel_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_can_access_region(p_region_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    fn_user_has_full_access()
    OR EXISTS (SELECT 1 FROM user_region_scopes WHERE user_id = auth.uid() AND region_id = p_region_id)
    OR EXISTS (
      SELECT 1 FROM user_hotel_scopes uhs
      JOIN hotels h ON h.id = uhs.hotel_id
      WHERE uhs.user_id = auth.uid() AND h.region_id = p_region_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fn_user_can_access_kpi(p_kpi_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM kpis k
    WHERE k.id = p_kpi_id
    AND (
      fn_user_has_full_access()
      OR (k.hotel_id IS NOT NULL AND fn_user_can_access_hotel(k.hotel_id))
      OR (k.region_id IS NOT NULL AND fn_user_can_access_region(k.region_id))
      OR (k.hotel_id IS NULL AND k.region_id IS NULL)
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- TRIGGER: PERFIL DE USUARIO AUTOMATICO (auth.users)
-- Ultima version: migracion 20250615000003_archive (rol analista por defecto)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'apellido'
  );

  -- Rol analista por defecto para acceso completo en dev/demo
  INSERT INTO public.user_roles (user_id, rol)
  VALUES (NEW.id, 'analista');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- FUNCION DE AUDITORIA
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id    UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::UUID,
    auth.uid()
  );
  SELECT email INTO v_user_email FROM user_profiles WHERE id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
    VALUES (v_user_id, v_user_email, 'crear', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
    VALUES (v_user_id, v_user_email, 'actualizar', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
    VALUES (v_user_id, v_user_email, 'eliminar', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_kpis AFTER INSERT OR UPDATE OR DELETE ON kpis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_kpi_targets AFTER INSERT OR UPDATE OR DELETE ON kpi_targets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_kpi_values AFTER INSERT OR UPDATE OR DELETE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_external_integrations AFTER INSERT OR UPDATE OR DELETE ON external_integrations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_action_plans AFTER INSERT OR UPDATE OR DELETE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_ai_configurations AFTER INSERT OR UPDATE OR DELETE ON ai_configurations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Inmutabilidad de audit_logs
CREATE OR REPLACE FUNCTION fn_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es inmutable: operacion % prohibida', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable();

-- Helper RPC para atribucion de usuario en auditoria (migracion 20250624000001)
CREATE OR REPLACE FUNCTION set_audit_user_context(p_user_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    PERFORM set_config('app.current_user_id', '', true);
  ELSE
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_audit_user_context(UUID) TO authenticated, service_role;

-- =============================================================================
-- CALCULO AUTOMATICO DE CUMPLIMIENTO Y SEMAFORO
-- =============================================================================

-- Calcula semaforo para un valor KPI dado
CREATE OR REPLACE FUNCTION fn_calc_semaforo(
  p_kpi_id          UUID,
  p_fecha           DATE,
  p_cumplimiento_pct NUMERIC
) RETURNS traffic_light_status AS $$
DECLARE
  v_cumplimiento_min NUMERIC;
  v_riesgo_min       NUMERIC;
  v_riesgo_max       NUMERIC;
BEGIN
  IF p_cumplimiento_pct IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct
  INTO v_cumplimiento_min, v_riesgo_min, v_riesgo_max
  FROM kpi_traffic_light_ranges
  WHERE kpi_id = p_kpi_id
    AND vigencia_desde <= p_fecha
    AND (vigencia_hasta IS NULL OR vigencia_hasta >= p_fecha)
  ORDER BY vigencia_desde DESC
  LIMIT 1;

  v_cumplimiento_min := COALESCE(v_cumplimiento_min, 100);
  v_riesgo_min       := COALESCE(v_riesgo_min, 80);
  v_riesgo_max       := COALESCE(v_riesgo_max, 99.99);

  IF p_cumplimiento_pct >= v_cumplimiento_min THEN
    RETURN 'cumplimiento';
  ELSIF p_cumplimiento_pct BETWEEN v_riesgo_min AND v_riesgo_max THEN
    RETURN 'riesgo';
  ELSE
    RETURN 'incumplimiento';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- BEFORE INSERT/UPDATE: calcula cumplimiento_pct
CREATE OR REPLACE FUNCTION fn_kpi_values_calc_cumplimiento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valor_meta IS NOT NULL AND NEW.valor_meta <> 0 THEN
    NEW.cumplimiento_pct := ROUND((NEW.valor_real / NEW.valor_meta) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kpi_values_calc ON kpi_values;
CREATE TRIGGER trg_kpi_values_calc
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_calc_cumplimiento();

-- BEFORE INSERT/UPDATE: asigna semaforo calculado
CREATE OR REPLACE FUNCTION fn_kpi_values_set_semaforo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cumplimiento_pct IS NOT NULL THEN
    NEW.semaforo := fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kpi_values_set_semaforo ON kpi_values;
CREATE TRIGGER trg_kpi_values_set_semaforo
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_set_semaforo();

-- =============================================================================
-- GENERACION AUTOMATICA DE ALERTAS (HU-KPI-008)
-- Version final: migracion 20250628000006_archive
-- (Evita recrear alertas para un kpi_value que ya tuvo alerta, incluyendo resueltas)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo    traffic_light_status;
  v_kpi_nombre  VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad   alert_severity;
  v_mensaje     TEXT;
  v_existe      BOOLEAN;
  v_estado      alert_status;
  v_escalada    BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  -- Evitar recrear si ya existe alguna alerta (incluyendo resueltas)
  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE kpi_value_id = NEW.id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NULL;
  END IF;

  SELECT nombre INTO v_kpi_nombre FROM kpis WHERE id = NEW.kpi_id;
  SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = NEW.hotel_id;

  IF v_semaforo = 'incumplimiento' THEN
    v_severidad := 'critico';
    v_estado    := 'escalada';
    v_escalada  := true;
  ELSE
    v_severidad := 'riesgo';
    v_estado    := 'activa';
    v_escalada  := false;
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' - ' || v_hotel_nombre ELSE '' END,
    NEW.valor_real,
    COALESCE(NEW.valor_meta::TEXT, 'N/A'),
    COALESCE(NEW.cumplimiento_pct::TEXT, 'N/A')
  );

  INSERT INTO alerts (
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje, escalada, escalada_at
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, v_estado, v_mensaje,
    v_escalada, CASE WHEN v_escalada THEN now() ELSE NULL END
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_kpi_values_create_alert ON kpi_values;
CREATE TRIGGER trg_kpi_values_create_alert
  AFTER INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_create_alert();

-- =============================================================================
-- INMUTABILIDAD DE ai_usage_logs
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_ai_usage_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_usage_logs es inmutable: operacion % no permitida', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_usage_logs_immutable ON ai_usage_logs;
CREATE TRIGGER trg_ai_usage_logs_immutable
  BEFORE UPDATE OR DELETE ON ai_usage_logs
  FOR EACH ROW EXECUTE FUNCTION fn_ai_usage_logs_immutable();

-- =============================================================================
-- FUNCIONES DE SINCRONIZACION Y UTILIDAD
-- =============================================================================

-- Escalamiento automatico de alertas sin plan tras 48h (migracion 20250617000001_archive)
CREATE OR REPLACE FUNCTION fn_escalate_stale_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escalated_count INTEGER := 0;
BEGIN
  UPDATE alerts a
  SET
    estado     = 'escalada',
    escalada   = true,
    escalada_at = now()
  WHERE a.estado = 'activa'
    AND a.created_at < now() - interval '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM action_plans ap
      WHERE ap.alert_id = a.id
    );

  GET DIAGNOSTICS escalated_count = ROW_COUNT;
  RETURN escalated_count;
END;
$$;

-- Alertas por valor KPI (backfill/sincronizacion) (migracion 20250628000006_archive)
-- Evita recrear alertas ya existentes (incluyendo resueltas)
CREATE OR REPLACE FUNCTION fn_sync_kpi_value_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count        INTEGER := 0;
  r              RECORD;
  v_hotel_nombre VARCHAR(150);
  v_severidad    alert_severity;
  v_estado       alert_status;
  v_escalada     BOOLEAN;
BEGIN
  FOR r IN
    WITH ranked AS (
      SELECT
        kv.id,
        kv.kpi_id,
        kv.hotel_id,
        kv.region_id,
        kv.valor_real,
        kv.valor_meta,
        kv.cumplimiento_pct,
        COALESCE(
          kv.semaforo,
          fn_calc_semaforo(kv.kpi_id, kv.fecha, kv.cumplimiento_pct)
        ) AS semaforo_calc,
        k.nombre AS kpi_nombre,
        ROW_NUMBER() OVER (
          PARTITION BY kv.kpi_id, kv.hotel_id, kv.region_id
          ORDER BY kv.fecha DESC, kv.created_at DESC
        ) AS rn
      FROM kpi_values kv
      JOIN kpis k ON k.id = kv.kpi_id AND k.estado = 'activo'
      WHERE kv.cumplimiento_pct IS NOT NULL
    )
    SELECT *
    FROM ranked
    WHERE rn = 1
      AND semaforo_calc IN ('riesgo', 'incumplimiento')
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.kpi_value_id = ranked.id
      )
  LOOP
    SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = r.hotel_id;

    IF r.semaforo_calc = 'incumplimiento' THEN
      v_severidad := 'critico';
      v_estado    := 'escalada';
      v_escalada  := true;
    ELSE
      v_severidad := 'riesgo';
      v_estado    := 'activa';
      v_escalada  := false;
    END IF;

    INSERT INTO alerts (
      kpi_id, kpi_value_id, hotel_id, region_id,
      severidad, estado, mensaje, escalada, escalada_at
    ) VALUES (
      r.kpi_id, r.id, r.hotel_id, r.region_id,
      v_severidad, v_estado,
      format(
        'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
        r.kpi_nombre,
        r.semaforo_calc,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' - ' || v_hotel_nombre ELSE '' END,
        r.valor_real,
        COALESCE(r.valor_meta::TEXT, 'N/A'),
        COALESCE(r.cumplimiento_pct::TEXT, 'N/A')
      ),
      v_escalada,
      CASE WHEN v_escalada THEN now() ELSE NULL END
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sync_kpi_value_alerts() TO authenticated;

-- Alertas por metas finalizadas (migracion 20250621000001_archive)
CREATE OR REPLACE FUNCTION fn_sync_expired_target_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count        INTEGER := 0;
  r              RECORD;
  v_hotel_nombre VARCHAR(150);
BEGIN
  FOR r IN
    SELECT
      t.id, t.kpi_id, t.hotel_id, t.region_id,
      t.fecha_inicio, t.fecha_fin, t.valor_meta, t.periodo_tipo,
      k.nombre AS kpi_nombre
    FROM kpi_targets t
    JOIN kpis k ON k.id = t.kpi_id
    WHERE t.fecha_fin < CURRENT_DATE
      AND k.estado = 'activo'
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.kpi_target_id = t.id
          AND a.estado IN ('activa', 'escalada')
      )
  LOOP
    SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = r.hotel_id;

    INSERT INTO alerts (
      kpi_id, kpi_target_id, hotel_id, region_id, severidad, estado, mensaje
    ) VALUES (
      r.kpi_id, r.id, r.hotel_id, r.region_id,
      'riesgo', 'activa',
      format(
        'Meta finalizada: KPI "%s" - periodo %s (%s a %s)%s. Valor meta: %s.',
        r.kpi_nombre, r.periodo_tipo, r.fecha_inicio, r.fecha_fin,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' - ' || v_hotel_nombre ELSE '' END,
        r.valor_meta
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sync_expired_target_alerts() TO authenticated;

-- =============================================================================
-- FUNCIONES RPC MODULO IA
-- =============================================================================

-- get_active_ai_api_key: version final con ranking y p_master_secret como parametro
-- (migracion 20260624000001)
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT);
DROP FUNCTION IF EXISTS get_active_ai_api_key(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_active_ai_api_key(
  p_provider      TEXT DEFAULT NULL,
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
    RAISE EXCEPTION 'AI_MASTER_SECRET no configurado o no enviado como parametro';
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
  'Retorna la API Key descifrada del proveedor IA activo. '
  'Si p_provider es NULL retorna el de mayor prioridad (ranking). '
  'Usar solo desde service_role.';

REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_active_ai_api_key(TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION get_active_ai_api_key(TEXT, TEXT) TO service_role;

-- upsert_ai_configuration_with_key: version final con ranking y multiples configuraciones
-- (migracion 20260624000001)
DROP FUNCTION IF EXISTS upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION upsert_ai_configuration_with_key(
  p_configuration_id     UUID,
  p_provider_id          UUID,
  p_api_key_plain        TEXT,
  p_master_secret        TEXT,
  p_modelo_defecto       TEXT,
  p_cuota_mensual_tokens INTEGER,
  p_descripcion          TEXT,
  p_ranking              INTEGER DEFAULT 1
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

    UPDATE ai_configurations
    SET
      provider_id    = p_provider_id,
      quota_mensual  = p_cuota_mensual_tokens,
      modelo_defecto = p_modelo_defecto,
      ranking        = p_ranking,
      descripcion    = p_descripcion,
      updated_at     = now()
    WHERE id = v_id;

    IF p_api_key_plain IS NOT NULL AND p_api_key_plain <> '' THEN
      UPDATE ai_configurations
      SET api_key_encrypted = pgp_sym_encrypt(p_api_key_plain, p_master_secret)
      WHERE id = v_id;
    END IF;
  ELSE
    INSERT INTO ai_configurations (
      provider_id, api_key_encrypted, quota_mensual,
      modelo_defecto, ranking, descripcion, estado
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
  'Crea o actualiza una configuracion IA cifrando la API Key. '
  'Permite multiples configuraciones por proveedor con ranking de prioridad. '
  'Solo ejecutable desde service_role.';

REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM authenticated;
REVOKE ALL ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION upsert_ai_configuration_with_key(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

-- list_ai_configurations_masked: listado con clave enmascarada (migracion 20260624000001)
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
    ('########' || right(encode(ac.api_key_encrypted, 'hex'), 4))::TEXT AS api_key_masked,
    ac.created_at,
    ac.ranking
  FROM ai_configurations ac
  JOIN ai_providers ap ON ap.id = ac.provider_id
  ORDER BY ac.ranking ASC, ac.created_at DESC;
END;
$$;

COMMENT ON FUNCTION list_ai_configurations_masked IS
  'Lista las configuraciones de IA con la clave enmascarada y en orden de prioridad. '
  'Usar desde backend.';

GRANT EXECUTE ON FUNCTION list_ai_configurations_masked() TO service_role;

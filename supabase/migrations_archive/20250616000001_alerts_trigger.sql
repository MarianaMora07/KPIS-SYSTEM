-- =============================================================================
-- Fase 4: Trigger automático de alertas (HU-KPI-008) + seed integración demo
-- =============================================================================

-- Calcula semáforo para un valor KPI
CREATE OR REPLACE FUNCTION fn_calc_semaforo(
  p_kpi_id UUID,
  p_fecha DATE,
  p_cumplimiento_pct NUMERIC
) RETURNS traffic_light_status AS $$
DECLARE
  v_cumplimiento_min NUMERIC;
  v_riesgo_min NUMERIC;
  v_riesgo_max NUMERIC;
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
  v_riesgo_min := COALESCE(v_riesgo_min, 80);
  v_riesgo_max := COALESCE(v_riesgo_max, 99.99);

  IF p_cumplimiento_pct >= v_cumplimiento_min THEN
    RETURN 'cumplimiento';
  ELSIF p_cumplimiento_pct BETWEEN v_riesgo_min AND v_riesgo_max THEN
    RETURN 'riesgo';
  ELSE
    RETURN 'incumplimiento';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Genera alerta cuando un valor queda en riesgo o incumplimiento
CREATE OR REPLACE FUNCTION fn_kpi_values_create_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaforo traffic_light_status;
  v_kpi_nombre VARCHAR(200);
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_mensaje TEXT;
  v_existe BOOLEAN;
BEGIN
  v_semaforo := COALESCE(
    NEW.semaforo,
    fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct)
  );

  IF v_semaforo IS NULL OR v_semaforo = 'cumplimiento' THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM alerts
    WHERE kpi_id = NEW.kpi_id
      AND estado = 'activa'
      AND (hotel_id IS NOT DISTINCT FROM NEW.hotel_id)
      AND kpi_value_id = NEW.id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NULL;
  END IF;

  SELECT nombre INTO v_kpi_nombre FROM kpis WHERE id = NEW.kpi_id;
  SELECT nombre INTO v_hotel_nombre FROM hotels WHERE id = NEW.hotel_id;

  IF v_semaforo = 'incumplimiento' THEN
    v_severidad := 'critico';
  ELSE
    v_severidad := 'riesgo';
  END IF;

  v_mensaje := format(
    'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
    v_kpi_nombre,
    v_semaforo,
    CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
    NEW.valor_real,
    COALESCE(NEW.valor_meta::TEXT, 'N/A'),
    COALESCE(NEW.cumplimiento_pct::TEXT, 'N/A')
  );

  INSERT INTO alerts (
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, 'activa', v_mensaje
  );

  RETURN NULL;
END;
$$;

-- Actualizar semáforo y alertar en BEFORE INSERT/UPDATE
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

DROP TRIGGER IF EXISTS trg_kpi_values_create_alert ON kpi_values;
CREATE TRIGGER trg_kpi_values_create_alert
  AFTER INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_create_alert();

-- Integración demo PMS (HU-KPI-005)
INSERT INTO external_integrations (id, nombre, sistema_tipo, endpoint_url, auth_config, mapeo_campos, frecuencia_cron, activa)
VALUES (
  'e5000000-0000-4000-8000-000000000001',
  'PMS Estelar Demo',
  'pms',
  'https://api.demo-pms.estelar.local/sync',
  '{"tipo": "api_key", "header": "X-API-Key"}'::jsonb,
  '{"ocupacion": "OCP-001", "revpar": "RVP-001"}'::jsonb,
  '0 6 * * *',
  true
) ON CONFLICT (id) DO NOTHING;

-- Bucket de storage para importaciones (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas storage imports
DROP POLICY IF EXISTS imports_upload ON storage.objects;
DROP POLICY IF EXISTS imports_read ON storage.objects;

CREATE POLICY imports_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY imports_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS action_plan_items
ALTER TABLE action_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_plan_items_select ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_insert ON action_plan_items;

CREATE POLICY action_plan_items_select ON action_plan_items FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IS DISTINCT FROM 'consulta'
);

CREATE POLICY action_plan_items_insert ON action_plan_items FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
);

-- Actualizar alertas (resolver / escalar)
DROP POLICY IF EXISTS alerts_update ON alerts;
CREATE POLICY alerts_update ON alerts FOR UPDATE USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('director_comercial', 'director_mercadeo', 'gerente_hotel', 'analista')
);

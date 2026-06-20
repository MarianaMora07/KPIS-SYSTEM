-- Reparación pipeline de alertas (HU-KPI-008)
-- Aplica si fn_calc_semaforo / triggers no existen en el proyecto remoto.

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

CREATE OR REPLACE FUNCTION fn_kpi_values_set_semaforo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cumplimiento_pct IS NOT NULL THEN
    NEW.semaforo := fn_calc_semaforo(NEW.kpi_id, NEW.fecha, NEW.cumplimiento_pct);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  v_estado alert_status;
  v_escalada BOOLEAN;
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
      AND estado IN ('activa', 'escalada')
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
    v_estado := 'escalada';
    v_escalada := true;
  ELSE
    v_severidad := 'riesgo';
    v_estado := 'activa';
    v_escalada := false;
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
    kpi_id, kpi_value_id, hotel_id, region_id, severidad, estado, mensaje, escalada, escalada_at
  ) VALUES (
    NEW.kpi_id, NEW.id, NEW.hotel_id, NEW.region_id, v_severidad, v_estado, v_mensaje,
    v_escalada, CASE WHEN v_escalada THEN now() ELSE NULL END
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_kpi_values_set_semaforo ON kpi_values;
CREATE TRIGGER trg_kpi_values_set_semaforo
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_set_semaforo();

DROP TRIGGER IF EXISTS trg_kpi_values_create_alert ON kpi_values;
CREATE TRIGGER trg_kpi_values_create_alert
  AFTER INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_create_alert();

-- Semáforo en valores históricos
UPDATE kpi_values
SET semaforo = fn_calc_semaforo(kpi_id, fecha, cumplimiento_pct)
WHERE cumplimiento_pct IS NOT NULL
  AND (semaforo IS NULL OR semaforo <> fn_calc_semaforo(kpi_id, fecha, cumplimiento_pct));

-- Requiere fn_sync_kpi_value_alerts (migración 20250628000003)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'fn_sync_kpi_value_alerts'
  ) THEN
    PERFORM fn_sync_kpi_value_alerts();
  END IF;
END $$;

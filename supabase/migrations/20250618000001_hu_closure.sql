-- HU-KPI-008: escalar automáticamente alertas críticas al crearlas
-- HU-KPI-012: auditoría en integraciones y planes de acción

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

CREATE TRIGGER trg_audit_external_integrations
  AFTER INSERT OR UPDATE OR DELETE ON external_integrations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_action_plans
  AFTER INSERT OR UPDATE OR DELETE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

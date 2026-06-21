-- Evita recrear alertas para un kpi_value que ya tuvo alerta (incl. resuelta manualmente)

CREATE OR REPLACE FUNCTION fn_sync_kpi_value_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
  v_hotel_nombre VARCHAR(150);
  v_severidad alert_severity;
  v_estado alert_status;
  v_escalada BOOLEAN;
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
      v_estado := 'escalada';
      v_escalada := true;
    ELSE
      v_severidad := 'riesgo';
      v_estado := 'activa';
      v_escalada := false;
    END IF;

    INSERT INTO alerts (
      kpi_id,
      kpi_value_id,
      hotel_id,
      region_id,
      severidad,
      estado,
      mensaje,
      escalada,
      escalada_at
    ) VALUES (
      r.kpi_id,
      r.id,
      r.hotel_id,
      r.region_id,
      v_severidad,
      v_estado,
      format(
        'KPI "%s" en estado %s%s. Valor: %s, Meta: %s, Cumplimiento: %s%%',
        r.kpi_nombre,
        r.semaforo_calc,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' — ' || v_hotel_nombre ELSE '' END,
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
    WHERE kpi_value_id = NEW.id
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

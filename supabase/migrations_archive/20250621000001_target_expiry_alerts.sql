-- Alertas por meta finalizada (HU-KPI-002 / HU-KPI-008)

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS kpi_target_id UUID REFERENCES kpi_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_kpi_target_id ON alerts(kpi_target_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_target_active
  ON alerts(kpi_target_id)
  WHERE kpi_target_id IS NOT NULL AND estado IN ('activa', 'escalada');

CREATE OR REPLACE FUNCTION fn_sync_expired_target_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
  v_hotel_nombre VARCHAR(150);
BEGIN
  FOR r IN
    SELECT
      t.id,
      t.kpi_id,
      t.hotel_id,
      t.region_id,
      t.fecha_inicio,
      t.fecha_fin,
      t.valor_meta,
      t.periodo_tipo,
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
      r.kpi_id,
      r.id,
      r.hotel_id,
      r.region_id,
      'riesgo',
      'activa',
      format(
        'Meta finalizada: KPI "%s" — periodo %s (%s a %s)%s. Valor meta: %s.',
        r.kpi_nombre,
        r.periodo_tipo,
        r.fecha_inicio,
        r.fecha_fin,
        CASE WHEN v_hotel_nombre IS NOT NULL THEN ' · ' || v_hotel_nombre ELSE '' END,
        r.valor_meta
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sync_expired_target_alerts() TO authenticated;

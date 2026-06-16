-- RLS para metas (kpi_targets) y rangos semáforo — HU-KPI-002
-- Sin políticas, INSERT falla si RLS está habilitado en el proyecto.

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

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_traffic_light_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_targets_select ON kpi_targets;
DROP POLICY IF EXISTS kpi_targets_insert ON kpi_targets;
DROP POLICY IF EXISTS kpi_targets_update ON kpi_targets;
DROP POLICY IF EXISTS kpi_targets_delete ON kpi_targets;

CREATE POLICY kpi_targets_select ON kpi_targets FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_targets_insert ON kpi_targets FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
  AND (
    hotel_id IS NULL
    OR fn_user_can_access_hotel(hotel_id)
    OR fn_user_has_full_access()
  )
);

CREATE POLICY kpi_targets_update ON kpi_targets FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_targets_delete ON kpi_targets FOR DELETE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

DROP POLICY IF EXISTS kpi_traffic_light_select ON kpi_traffic_light_ranges;
DROP POLICY IF EXISTS kpi_traffic_light_insert ON kpi_traffic_light_ranges;
DROP POLICY IF EXISTS kpi_traffic_light_update ON kpi_traffic_light_ranges;
DROP POLICY IF EXISTS kpi_traffic_light_delete ON kpi_traffic_light_ranges;

CREATE POLICY kpi_traffic_light_select ON kpi_traffic_light_ranges FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_insert ON kpi_traffic_light_ranges FOR INSERT WITH CHECK (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_update ON kpi_traffic_light_ranges FOR UPDATE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_traffic_light_delete ON kpi_traffic_light_ranges FOR DELETE USING (
  fn_current_user_role() IS DISTINCT FROM 'consulta'
  AND fn_user_can_access_kpi(kpi_id)
);

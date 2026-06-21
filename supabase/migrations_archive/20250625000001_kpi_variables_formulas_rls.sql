-- RLS para variables y fórmulas (HU-KPI-003)
-- Sin políticas, INSERT falla si RLS está habilitado en el proyecto.

ALTER TABLE kpi_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_variables_select ON kpi_variables;
DROP POLICY IF EXISTS kpi_variables_insert ON kpi_variables;
DROP POLICY IF EXISTS kpi_variables_update ON kpi_variables;

CREATE POLICY kpi_variables_select ON kpi_variables FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_variables_insert ON kpi_variables FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_variables_update ON kpi_variables FOR UPDATE USING (
  fn_current_user_role() = 'administrador'
);

DROP POLICY IF EXISTS kpi_formulas_select ON kpi_formulas;
DROP POLICY IF EXISTS kpi_formulas_insert ON kpi_formulas;

CREATE POLICY kpi_formulas_select ON kpi_formulas FOR SELECT USING (
  fn_user_can_access_kpi(kpi_id)
);

CREATE POLICY kpi_formulas_insert ON kpi_formulas FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
  AND fn_user_can_access_kpi(kpi_id)
);

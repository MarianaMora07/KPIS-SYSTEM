-- Solo el administrador puede eliminar valores de KPI
DROP POLICY IF EXISTS kpi_values_delete ON kpi_values;

CREATE POLICY kpi_values_delete ON kpi_values FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);

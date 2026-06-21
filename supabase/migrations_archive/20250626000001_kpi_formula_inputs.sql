-- HU-KPI-003: inputs por variable y constraint para variables compuestas

ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS variable_inputs JSONB;

COMMENT ON COLUMN kpi_values.variable_inputs IS
  'Valores de entrada por código de variable usados al calcular valor_real';

ALTER TABLE kpi_variables
  DROP CONSTRAINT IF EXISTS kpi_variables_compuesta_formula_chk;

ALTER TABLE kpi_variables
  ADD CONSTRAINT kpi_variables_compuesta_formula_chk CHECK (
    tipo = 'simple'
    OR (tipo = 'compuesta' AND formula_compuesta IS NOT NULL AND trim(formula_compuesta) <> '')
  );

-- RLS para vínculo fórmula ↔ variables
ALTER TABLE kpi_formula_variables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_formula_variables_select ON kpi_formula_variables;
DROP POLICY IF EXISTS kpi_formula_variables_insert ON kpi_formula_variables;
DROP POLICY IF EXISTS kpi_formula_variables_delete ON kpi_formula_variables;

CREATE POLICY kpi_formula_variables_select ON kpi_formula_variables FOR SELECT TO authenticated USING (true);

CREATE POLICY kpi_formula_variables_insert ON kpi_formula_variables FOR INSERT WITH CHECK (
  fn_current_user_role() = 'administrador'
);

CREATE POLICY kpi_formula_variables_delete ON kpi_formula_variables FOR DELETE USING (
  fn_current_user_role() = 'administrador'
);

-- Vincular valores KPI a la integración que los cargó (eliminación en cascada)

ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES external_integrations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_kpi_values_integration_id ON kpi_values(integration_id);

COMMENT ON COLUMN kpi_values.integration_id IS
  'Integración que cargó el valor; NULL para manual/import';

DROP POLICY IF EXISTS kpi_values_delete ON kpi_values;

CREATE POLICY kpi_values_delete ON kpi_values FOR DELETE USING (
  fn_current_user_role() = 'administrador'
  OR (
    fn_current_user_role() = 'analista'
    AND integration_id IS NOT NULL
  )
);

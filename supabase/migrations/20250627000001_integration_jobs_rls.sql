-- HU-KPI-005: políticas RLS para jobs y logs de integraciones (sync manual y cron)

ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_jobs_select ON integration_jobs;
DROP POLICY IF EXISTS integration_jobs_insert ON integration_jobs;
DROP POLICY IF EXISTS integration_jobs_update ON integration_jobs;
DROP POLICY IF EXISTS integration_logs_select ON integration_logs;
DROP POLICY IF EXISTS integration_jobs_delete ON integration_jobs;
DROP POLICY IF EXISTS integration_logs_insert ON integration_logs;
DROP POLICY IF EXISTS integration_logs_delete ON integration_logs;

CREATE POLICY integration_jobs_select ON integration_jobs FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_insert ON integration_jobs FOR INSERT WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_update ON integration_jobs FOR UPDATE USING (
  fn_current_user_role() IN ('administrador', 'analista')
) WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_select ON integration_logs FOR SELECT USING (
  fn_user_has_full_access()
  OR fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_insert ON integration_logs FOR INSERT WITH CHECK (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_jobs_delete ON integration_jobs FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

CREATE POLICY integration_logs_delete ON integration_logs FOR DELETE USING (
  fn_current_user_role() IN ('administrador', 'analista')
);

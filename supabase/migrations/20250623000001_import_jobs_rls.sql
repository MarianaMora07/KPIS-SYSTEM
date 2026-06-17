-- Permisos faltantes para procesar importaciones (UPDATE estado, errores por fila)

CREATE POLICY import_jobs_update ON import_jobs FOR UPDATE USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
) WITH CHECK (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

CREATE POLICY import_jobs_delete ON import_jobs FOR DELETE USING (
  auth.uid() = usuario_id OR fn_user_has_full_access()
);

ALTER TABLE import_job_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_job_errors_select ON import_job_errors FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = import_job_id
      AND (ij.usuario_id = auth.uid() OR fn_user_has_full_access())
  )
);

CREATE POLICY import_job_errors_insert ON import_job_errors FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = import_job_id
      AND (ij.usuario_id = auth.uid() OR fn_user_has_full_access())
  )
);

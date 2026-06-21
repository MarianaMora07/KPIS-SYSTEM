-- Políticas de storage para el bucket imports (subida, lectura, reemplazo)

DROP POLICY IF EXISTS imports_upload ON storage.objects;
DROP POLICY IF EXISTS imports_read ON storage.objects;
DROP POLICY IF EXISTS imports_update ON storage.objects;
DROP POLICY IF EXISTS imports_delete ON storage.objects;

CREATE POLICY imports_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY imports_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY imports_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY imports_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Alinear INSERT de jobs con roles que tienen import.cargar
DROP POLICY IF EXISTS import_jobs_insert ON import_jobs;
CREATE POLICY import_jobs_insert ON import_jobs FOR INSERT WITH CHECK (
  auth.uid() = usuario_id
  AND fn_current_user_role() IN ('administrador', 'analista', 'gerente_hotel')
);

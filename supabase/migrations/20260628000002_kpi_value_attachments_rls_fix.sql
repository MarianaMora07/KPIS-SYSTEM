-- =============================================================================
-- KPIs System — Corrección de políticas RLS para adjuntos de soportes
-- =============================================================================

DROP POLICY IF EXISTS "Insert own attachments" ON public.kpi_value_attachments;

CREATE POLICY "Insert attachments based on hotel access"
ON public.kpi_value_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.kpi_values kv
    WHERE kv.id = kpi_value_attachments.kpi_value_id
    AND public.fn_user_can_access_hotel(kv.hotel_id)
  )
);

DROP POLICY IF EXISTS kpi_evidences_insert ON storage.objects;

CREATE POLICY kpi_evidences_insert ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'kpi-evidences');

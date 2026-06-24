-- =============================================================================
-- KPIs System — IA: Corrección de Políticas RLS para Adjuntos de Soportes
-- =============================================================================

-- 1. Eliminar la política restrictiva anterior
DROP POLICY IF EXISTS "Insert own attachments" ON public.kpi_value_attachments;

-- 2. Crear una nueva política basada en el acceso comprobado al hotel de la medición
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

-- 3. Asegurar la política de inserción del Storage por si ocurre un desfase de tokens en el cliente del servidor
DROP POLICY IF EXISTS kpi_evidences_insert ON storage.objects;

CREATE POLICY kpi_evidences_insert ON storage.objects 
FOR INSERT
WITH CHECK (bucket_id = 'kpi-evidences');
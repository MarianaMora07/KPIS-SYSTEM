-- =============================================================================
-- KPIs System — IA: Tabla de Adjuntos Opcionales para Mediciones
-- =============================================================================

CREATE TABLE public.kpi_value_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  kpi_value_id UUID NOT NULL, -- Relación directa con la medición registrada
  file_name CHARACTER VARYING(255) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT kpi_value_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_attachment_kpi_value FOREIGN KEY (kpi_value_id) REFERENCES public.kpi_values (id) ON DELETE CASCADE,
  CONSTRAINT fk_attachment_user FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles (id)
);

-- Habilitar seguridad a nivel de fila (RLS)
ALTER TABLE public.kpi_value_attachments ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver adjuntos de las mediciones a las que tienen acceso
CREATE POLICY "Select attachments based on access"
ON public.kpi_value_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.kpi_values kv
    WHERE kv.id = kpi_value_attachments.kpi_value_id
    AND public.fn_user_can_access_hotel(kv.hotel_id)
  )
);

-- Los usuarios pueden insertar sus propios soportes
CREATE POLICY "Insert own attachments"
ON public.kpi_value_attachments
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);
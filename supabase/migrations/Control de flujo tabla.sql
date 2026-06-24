-- 1. Crear el tipo enumerado para los estados del workflow si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_type') THEN
    CREATE TYPE request_type AS ENUM ('creacion', 'edicion', 'medicion');
  END IF;
END $$;

-- 2. Crear la tabla de solicitudes de aprobación
CREATE TABLE public.kpi_approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  kpi_id UUID NULL, -- Puede ser nulo si es una creación de un KPI completamente nuevo
  solicitante_id UUID NOT NULL,
  aprobador_id UUID NULL,
  hotel_id UUID NOT NULL, -- Para asegurar el aislamiento por hotel designado
  tipo request_type NOT NULL,
  estado approval_status NOT NULL DEFAULT 'pendiente',
  datos_propuestos JSONB NOT NULL, -- Contiene el payload del KPI o la medición a aplicar
  observaciones TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT kpi_approval_requests_pkey PRIMARY KEY (id),
  CONSTRAINT fk_approval_solicitante FOREIGN KEY (solicitante_id) REFERENCES public.user_profiles (id),
  CONSTRAINT fk_approval_aprobador FOREIGN KEY (aprobador_id) REFERENCES public.user_profiles (id)
);

-- 3. Habilitar RLS y crear políticas de seguridad básicas
ALTER TABLE public.kpi_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver solicitudes de su propio hotel" 
ON public.kpi_approval_requests 
FOR SELECT 
USING (hotel_id = (SELECT hotel_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Service role control total" 
ON public.kpi_approval_requests 
FOR ALL 
TO service_role 
USING (true);
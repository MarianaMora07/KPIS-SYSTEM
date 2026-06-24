-- =============================================================================
-- KPIs System — Relaciones y Llaves Foráneas para Aprobaciones
-- =============================================================================

-- Agregar llaves foráneas faltantes para establecer relaciones que PostgREST pueda resolver
ALTER TABLE public.kpi_approval_requests
  ADD CONSTRAINT fk_approval_hotel FOREIGN KEY (hotel_id) REFERENCES public.hotels (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_approval_kpi FOREIGN KEY (kpi_id) REFERENCES public.kpis (id) ON DELETE CASCADE;

-- =============================================================================
-- Fase 3: Seed demo, cálculo automático de cumplimiento, rol default
-- =============================================================================

-- Rol analista por defecto al registrarse (acceso completo para demo/dev)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'apellido'
  );

  INSERT INTO public.user_roles (user_id, rol)
  VALUES (NEW.id, 'analista');

  RETURN NEW;
END;
$$;

-- Auto-calcular cumplimiento_pct al insertar/actualizar valores (HU-KPI-002)
CREATE OR REPLACE FUNCTION fn_kpi_values_calc_cumplimiento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valor_meta IS NOT NULL AND NEW.valor_meta <> 0 THEN
    NEW.cumplimiento_pct := ROUND((NEW.valor_real / NEW.valor_meta) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kpi_values_calc
  BEFORE INSERT OR UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_values_calc_cumplimiento();

-- Vista enriquecida para dashboard (HU-KPI-006)
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  kv.id,
  kv.kpi_id,
  k.nombre AS kpi_nombre,
  k.codigo AS kpi_codigo,
  k.unidad_medida,
  kv.hotel_id,
  h.nombre AS hotel_nombre,
  kv.region_id,
  r.nombre AS region_nombre,
  kv.fecha,
  kv.valor_real,
  kv.valor_meta,
  kv.cumplimiento_pct,
  kv.fuente,
  COALESCE(
    kv.semaforo,
    CASE
      WHEN kv.cumplimiento_pct IS NULL THEN NULL
      WHEN kv.cumplimiento_pct >= COALESCE(tlr.cumplimiento_min_pct, 100) THEN 'cumplimiento'::traffic_light_status
      WHEN kv.cumplimiento_pct BETWEEN COALESCE(tlr.riesgo_min_pct, 80) AND COALESCE(tlr.riesgo_max_pct, 99.99)
        THEN 'riesgo'::traffic_light_status
      ELSE 'incumplimiento'::traffic_light_status
    END
  ) AS semaforo_calculado
FROM kpi_values kv
JOIN kpis k ON k.id = kv.kpi_id
LEFT JOIN hotels h ON h.id = kv.hotel_id
LEFT JOIN regions r ON r.id = kv.region_id
LEFT JOIN LATERAL (
  SELECT * FROM kpi_traffic_light_ranges t
  WHERE t.kpi_id = kv.kpi_id
    AND t.vigencia_desde <= kv.fecha
    AND (t.vigencia_hasta IS NULL OR t.vigencia_hasta >= kv.fecha)
  ORDER BY t.vigencia_desde DESC
  LIMIT 1
) tlr ON true
WHERE k.estado = 'activo';

GRANT SELECT ON v_dashboard_kpis TO authenticated;

-- ---------------------------------------------------------------------------
-- Datos demo Hoteles Estelar
-- ---------------------------------------------------------------------------
INSERT INTO regions (id, codigo, nombre) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'AND', 'Región Andina'),
  ('a1000000-0000-4000-8000-000000000002', 'CAR', 'Región Caribe'),
  ('a1000000-0000-4000-8000-000000000003', 'PAC', 'Región Pacífico');

INSERT INTO hotels (id, region_id, codigo, nombre, ciudad) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'BOG', 'Estelar Bogotá', 'Bogotá'),
  ('b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'CTG', 'Estelar Cartagena', 'Cartagena'),
  ('b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'CLO', 'Estelar Cali', 'Cali');

INSERT INTO kpi_categories (id, codigo, nombre) VALUES
  ('c3000000-0000-4000-8000-000000000001', 'COM', 'Comercial'),
  ('c3000000-0000-4000-8000-000000000002', 'MKT', 'Mercadeo'),
  ('c3000000-0000-4000-8000-000000000003', 'REV', 'Revenue');

INSERT INTO kpis (id, nombre, codigo, categoria_id, area_responsable, frecuencia, unidad_medida, meta, fuente_informacion, tipo_indicador, hotel_id, region_id) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'Ocupación', 'OCP-001', 'c3000000-0000-4000-8000-000000000001', 'Ventas', 'mensual', '%', 82.0000, 'PMS', 'estrategico', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000002', 'RevPAR', 'RVP-001', 'c3000000-0000-4000-8000-000000000003', 'Revenue', 'mensual', 'COP', 138000.0000, 'PMS', 'estrategico', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000003', 'Conversión web', 'CNV-001', 'c3000000-0000-4000-8000-000000000002', 'Mercadeo Digital', 'mensual', '%', 2.5000, 'CRM', 'tactico', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002'),
  ('d4000000-0000-4000-8000-000000000004', 'NPS', 'NPS-001', 'c3000000-0000-4000-8000-000000000001', 'Experiencia', 'mensual', 'pts', 70.0000, 'Encuestas', 'operativo', 'b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003');

INSERT INTO kpi_traffic_light_ranges (kpi_id, cumplimiento_min_pct, riesgo_min_pct, riesgo_max_pct, incumplimiento_max_pct) VALUES
  ('d4000000-0000-4000-8000-000000000001', 100.00, 80.00, 99.99, 79.99),
  ('d4000000-0000-4000-8000-000000000002', 100.00, 80.00, 99.99, 79.99),
  ('d4000000-0000-4000-8000-000000000003', 100.00, 80.00, 99.99, 79.99),
  ('d4000000-0000-4000-8000-000000000004', 100.00, 80.00, 99.99, 79.99);

INSERT INTO kpi_targets (kpi_id, periodo_tipo, fecha_inicio, fecha_fin, valor_meta, hotel_id) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'mensual', '2026-06-01', '2026-06-30', 82.0000, 'b2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000002', 'mensual', '2026-06-01', '2026-06-30', 138000.0000, 'b2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000003', 'mensual', '2026-06-01', '2026-06-30', 2.5000, 'b2000000-0000-4000-8000-000000000002'),
  ('d4000000-0000-4000-8000-000000000004', 'mensual', '2026-06-01', '2026-06-30', 70.0000, 'b2000000-0000-4000-8000-000000000003');

INSERT INTO kpi_values (kpi_id, hotel_id, region_id, fecha, valor_real, valor_meta, fuente) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-06-01', 78.4000, 82.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-06-01', 142500.0000, 138000.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '2026-06-01', 2.1000, 2.5000, 'manual'),
  ('d4000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '2026-06-01', 72.0000, 70.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-05-01', 81.2000, 82.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-05-01', 135000.0000, 138000.0000, 'manual');

-- Histórico adicional para tendencias (HU-KPI-007)
INSERT INTO kpi_values (kpi_id, hotel_id, region_id, fecha, valor_real, valor_meta, fuente) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-04-01', 79.8000, 82.0000, 'manual'),
  ('d4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-03-01', 83.5000, 82.0000, 'manual');

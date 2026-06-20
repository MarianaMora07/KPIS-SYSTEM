-- Unicidad para upsert de integraciones: (kpi_id, hotel_id, fecha)

-- Conservar el registro más reciente si hay duplicados
DELETE FROM kpi_values a
USING kpi_values b
WHERE a.kpi_id = b.kpi_id
  AND a.hotel_id IS NOT DISTINCT FROM b.hotel_id
  AND a.fecha = b.fecha
  AND a.created_at < b.created_at;

DELETE FROM kpi_values a
USING kpi_values b
WHERE a.kpi_id = b.kpi_id
  AND a.hotel_id IS NOT DISTINCT FROM b.hotel_id
  AND a.fecha = b.fecha
  AND a.id < b.id;

DROP INDEX IF EXISTS idx_kpi_values_composite;

CREATE UNIQUE INDEX idx_kpi_values_kpi_hotel_fecha
  ON kpi_values (kpi_id, hotel_id, fecha);

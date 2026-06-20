-- Corregir mapeo demo PMS → códigos KPI del seed (OCP-001, RVP-001)

UPDATE external_integrations
SET mapeo_campos = '{"ocupacion": "OCP-001", "revpar": "RVP-001"}'::jsonb,
    updated_at = now()
WHERE id = 'e5000000-0000-4000-8000-000000000001'
   OR mapeo_campos @> '{"ocupacion": "occupancy_rate"}'::jsonb
   OR mapeo_campos @> '{"revpar": "revpar"}'::jsonb;

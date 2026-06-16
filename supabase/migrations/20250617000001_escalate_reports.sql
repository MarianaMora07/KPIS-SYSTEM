-- Escalamiento automático de alertas sin plan tras 48h
-- Programación reportes ejecutivos

CREATE OR REPLACE FUNCTION fn_escalate_stale_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escalated_count INTEGER := 0;
BEGIN
  UPDATE alerts a
  SET
    estado = 'escalada',
    escalada = true,
    escalada_at = now()
  WHERE a.estado = 'activa'
    AND a.created_at < now() - interval '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM action_plans ap
      WHERE ap.alert_id = a.id
    );

  GET DIAGNOSTICS escalated_count = ROW_COUNT;
  RETURN escalated_count;
END;
$$;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL,
  nombre        VARCHAR(150) NOT NULL DEFAULT 'Reporte semanal',
  filtros       JSONB NOT NULL DEFAULT '{}',
  frecuencia_cron VARCHAR(50) NOT NULL DEFAULT '0 8 * * 1',
  formato       VARCHAR(20) NOT NULL DEFAULT 'pdf',
  emails        TEXT[] NOT NULL DEFAULT '{}',
  activo        BOOLEAN NOT NULL DEFAULT true,
  ultima_ejecucion TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_activo ON scheduled_reports(activo);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_reports_own ON scheduled_reports
  FOR ALL USING (usuario_id = auth.uid());

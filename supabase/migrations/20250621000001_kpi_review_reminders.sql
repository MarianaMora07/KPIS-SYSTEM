-- Recordatorios por correo según frecuencia del KPI (revisión / registro de valor)

ALTER TABLE kpis
  ADD COLUMN IF NOT EXISTS recordatorio_email_activo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_emails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ultimo_recordatorio_at TIMESTAMPTZ;

COMMENT ON COLUMN kpis.recordatorio_email_activo IS 'Envía recordatorio de revisión según frecuencia vía Activepieces';
COMMENT ON COLUMN kpis.recordatorio_emails IS 'Destinatarios adicionales del recordatorio (además del responsable)';
COMMENT ON COLUMN kpis.ultimo_recordatorio_at IS 'Última vez que se disparó kpi.review.due para este KPI';

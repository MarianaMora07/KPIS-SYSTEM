-- =============================================================================
-- KPIs System — IA: Tabla de Modelos Relacionales
-- =============================================================================

CREATE TABLE ai_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  codigo        VARCHAR(100) NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, codigo)
);

CREATE INDEX idx_ai_models_provider ON ai_models(provider_id);

-- ---------------------------------------------------------------------------
-- SEGURIDAD (Row Level Security - RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_models_select ON ai_models FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_models_manage ON ai_models FOR ALL USING (fn_current_user_role() = 'administrador');

-- ---------------------------------------------------------------------------
-- SEMILLA (Modelos de ejemplo para los proveedores existentes)
-- Nota: Utiliza subconsultas para no depender de IDs estáticos.
-- ---------------------------------------------------------------------------

-- Google Gemini
INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'gemini-1.5-flash', 'Gemini 1.5 Flash (Rápido)' FROM ai_providers WHERE codigo = 'google_gemini'
UNION ALL
SELECT id, 'gemini-1.5-pro', 'Gemini 1.5 Pro (Razonamiento Complejo)' FROM ai_providers WHERE codigo = 'google_gemini'
ON CONFLICT DO NOTHING;

-- Groq
INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'llama3-8b-8192', 'Llama 3 8B (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'llama3-70b-8192', 'Llama 3 70B (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'mixtral-8x7b-32768', 'Mixtral 8x7B (Groq)' FROM ai_providers WHERE codigo = 'groq'
ON CONFLICT DO NOTHING;

-- OpenRouter
INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'meta-llama/llama-3-70b-instruct', 'Llama 3 70B Instruct' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'google/gemini-flash-1.5', 'Gemini 1.5 Flash (Vía OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
ON CONFLICT DO NOTHING;
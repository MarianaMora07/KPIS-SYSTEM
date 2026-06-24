-- =============================================================================
-- KPIs System — IA: Tabla de Modelos Relacionales y Semilla Completa
-- Migración: 20260623000005_ai_models.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  codigo        VARCHAR(100) NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  estado        entity_status NOT NULL DEFAULT 'activo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_id);

-- SEGURIDAD (Row Level Security - RLS)
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_models_select ON ai_models;
CREATE POLICY ai_models_select ON ai_models 
  FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS ai_models_manage ON ai_models;
CREATE POLICY ai_models_manage ON ai_models 
  FOR ALL TO authenticated
  USING (fn_current_user_role() = 'administrador');

-- SEED: Proveedores adicionales groq y openrouter
INSERT INTO ai_providers (nombre, codigo, estado)
VALUES 
  ('Groq', 'groq', 'activo'),
  ('OpenRouter', 'openrouter', 'activo')
ON CONFLICT (codigo) DO NOTHING;

-- SEED: Modelos para Google Gemini
INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'gemini-1.5-flash', 'Gemini 1.5 Flash' FROM ai_providers WHERE codigo = 'google_gemini'
UNION ALL
SELECT id, 'gemini-1.5-pro', 'Gemini 1.5 Pro' FROM ai_providers WHERE codigo = 'google_gemini'
UNION ALL
SELECT id, 'gemini-2.5-flash', 'Gemini 2.5 Flash' FROM ai_providers WHERE codigo = 'google_gemini'
UNION ALL
SELECT id, 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite' FROM ai_providers WHERE codigo = 'google_gemini'
ON CONFLICT (provider_id, codigo) DO NOTHING;

-- SEED: Modelos para Groq
INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'llama3-8b-8192', 'Llama 3 8B (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'llama3-70b-8192', 'Llama 3 70B (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'mixtral-8x7b-32768', 'Mixtral 8x7B (Groq)' FROM ai_providers WHERE codigo = 'groq'
UNION ALL
SELECT id, 'gemma2-9b-it', 'Gemma 2 9B (Groq)' FROM ai_providers WHERE codigo = 'groq'
ON CONFLICT (provider_id, codigo) DO NOTHING;

-- SEED: Modelos para OpenRouter
INSERT INTO ai_models (provider_id, codigo, nombre)
SELECT id, 'meta-llama/llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'meta-llama/llama-3.1-8b-instruct', 'Llama 3.1 8B Instruct (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'google/gemini-2.5-flash', 'Gemini 2.5 Flash (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'google/gemini-2.5-pro', 'Gemini 2.5 Pro (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'deepseek/deepseek-chat', 'DeepSeek V3 (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
UNION ALL
SELECT id, 'meta-llama/llama-3-70b-instruct', 'Llama 3 70B Instruct (OpenRouter)' FROM ai_providers WHERE codigo = 'openrouter'
ON CONFLICT (provider_id, codigo) DO NOTHING;

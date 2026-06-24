-- =============================================================================
-- KPIs System — IA: Tabla de Modelos Relacionales (Parche de Tipos)
-- =============================================================================

-- 1. Asegurar que los proveedores tengan el código técnico exacto
INSERT INTO ai_providers (codigo, nombre, estado) VALUES 
  ('google_gemini', 'Google Gemini', 'activo'::entity_status),
  ('groq', 'GroqCloud', 'activo'::entity_status),
  ('openrouter', 'OpenRouter', 'activo'::entity_status)
ON CONFLICT (codigo) DO UPDATE SET estado = 'activo'::entity_status;

-- 2. Limpiar modelos viejos para evitar conflictos de ID y duplicados
DELETE FROM ai_models WHERE provider_id IN (SELECT id FROM ai_providers WHERE codigo IN ('groq', 'openrouter'));

-- 3. Insertar Modelos Oficiales de Groq (Con casteo explícito de ENUM)
INSERT INTO ai_models (provider_id, codigo, nombre, estado)
SELECT id, 'llama-3.1-8b-instant', 'Llama 3.1 8B (Instant)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'llama-3.3-70b-versatile', 'Llama 3.3 70B (Versatile)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'groq' UNION ALL
SELECT id, 'openai/gpt-oss-120b', 'GPT-OSS 120B (Groq Featured)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'groq';

-- 4. Insertar Modelos Gratuitos de OpenRouter (Con casteo explícito de ENUM)
INSERT INTO ai_models (provider_id, codigo, nombre, estado)
SELECT id, 'openai/gpt-oss-120b:free', 'OpenAI: GPT-OSS 120B (Free)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'openai/gpt-oss-20b:free', 'OpenAI: GPT-OSS 20B (Free)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'meta-llama/llama-3.3-70b-instruct:free', 'Meta: Llama 3.3 70B Instruct (Free)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'openrouter' UNION ALL
SELECT id, 'google/gemma-4-31b:free', 'Google: Gemma 4 31B (Free)', 'activo'::entity_status FROM ai_providers WHERE codigo = 'openrouter';
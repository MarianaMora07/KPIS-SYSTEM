import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type GenerateContentResult,
  type ResponseSchema,
} from "@google/generative-ai";
import { resolveActiveAiKey } from "./key-resolver";

/** Modelos verificados en API v1beta (jun 2026) */
const MODEL_CANDIDATES = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

type GeminiGenerationConfig = {
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: ResponseSchema;
  thinkingConfig?: { thinkingBudget?: number };
};

/**
 * Métricas de tokens devueltas por la API en cada petición.
 * Se usan para alimentar la tabla ai_usage_logs.
 */
export type TokenUsage = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export function getGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (configured && MODEL_CANDIDATES.includes(configured as (typeof MODEL_CANDIDATES)[number])) {
    return configured;
  }
  if (configured && !MODEL_CANDIDATES.includes(configured as (typeof MODEL_CANDIDATES)[number])) {
    return MODEL_CANDIDATES[0];
  }
  return MODEL_CANDIDATES[0];
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function buildGenerationConfig(
  modelName: string,
  options?: { maxTokens?: number; temperature?: number },
  extra?: Pick<GeminiGenerationConfig, "responseMimeType" | "responseSchema">
): GeminiGenerationConfig {
  const config: GeminiGenerationConfig = {
    maxOutputTokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.4,
    ...extra,
  };

  if (/gemini-2\.5-flash(?!-lite)/.test(modelName)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  return config;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("503") ||
    /high demand/i.test(message) ||
    message.includes("429") ||
    /quota exceeded/i.test(message) ||
    /resource exhausted/i.test(message)
  );
}

function getModelWithName(modelName: string, apiKey?: string) {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY no configurada");
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: modelName });
}

function getModelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim();
  const ordered = configured
    ? [configured, ...MODEL_CANDIDATES.filter((m) => m !== configured)]
    : [...MODEL_CANDIDATES];
  return [...new Set(ordered)];
}

function assertCompleteResponse(result: GenerateContentResult) {
  const finishReason = result.response.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "La respuesta de Gemini se truncó. Intente de nuevo o use gemini-2.5-flash-lite."
    );
  }
}

function extractTokenUsage(result: GenerateContentResult): TokenUsage {
  const meta = result.response.usageMetadata;
  const promptCount = meta?.promptTokenCount ?? 0;
  const candidatesCount = meta?.candidatesTokenCount ?? 0;
  const totalCount = meta?.totalTokenCount ?? 0;
  return {
    promptTokenCount: promptCount,
    candidatesTokenCount: candidatesCount,
    totalTokenCount: totalCount,
    promptTokens: promptCount,
    completionTokens: candidatesCount,
    totalTokens: totalCount,
  };
}

async function generateContentWithRetry(
  request: GenerateContentRequest,
  options?: { maxTokens?: number; temperature?: number },
  extra?: Pick<GeminiGenerationConfig, "responseMimeType" | "responseSchema">,
  apiKey?: string,
  modelName?: string
): Promise<{ result: GenerateContentResult; usage: TokenUsage }> {
  const models = modelName ? [modelName, ...getModelCandidates().filter((m) => m !== modelName)] : getModelCandidates();
  let lastError: unknown;

  for (const name of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const modelInstance = getModelWithName(name, apiKey);
        const result = await modelInstance.generateContent({
          ...request,
          generationConfig: buildGenerationConfig(name, options, extra),
        });
        assertCompleteResponse(result);
        return { result, usage: extractTokenUsage(result) };
      } catch (error) {
        lastError = error;
        if (!isRetryableGeminiError(error) || attempt === 2) break;
        await sleep(600 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

// =============================================================================
// PATRÓN DE DISEÑO: DRIVERS DE PROVEEDORES IA
// =============================================================================

export interface AiDriver {
  generateText(
    apiKey: string,
    model: string,
    prompt: string,
    options?: { maxTokens?: number }
  ): Promise<{ text: string; usage: TokenUsage }>;

  generateJson<T>(
    apiKey: string,
    model: string,
    prompt: string,
    schema: ResponseSchema,
    options?: { maxTokens?: number }
  ): Promise<{ data: T; usage: TokenUsage }>;
}

/**
 * Driver oficial para Google Gemini
 */
export class GoogleGeminiDriver implements AiDriver {
  async generateText(
    apiKey: string,
    model: string,
    prompt: string,
    options?: { maxTokens?: number }
  ): Promise<{ text: string; usage: TokenUsage }> {
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const { result, usage } = await generateContentWithRetry(
      payload as GenerateContentRequest,
      { maxTokens: options?.maxTokens ?? 1024 },
      undefined,
      apiKey,
      model
    );
    return { text: result.response.text(), usage };
  }

  async generateJson<T>(
    apiKey: string,
    model: string,
    prompt: string,
    schema: ResponseSchema,
    options?: { maxTokens?: number }
  ): Promise<{ data: T; usage: TokenUsage }> {
    console.log(`[GoogleGeminiDriver] generateJson starting with model: ${model}`);
    try {
      const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
      const { result, usage } = await generateContentWithRetry(
        payload as GenerateContentRequest,
        { maxTokens: options?.maxTokens ?? 1024 },
        { responseMimeType: "application/json", responseSchema: schema },
        apiKey,
        model
      );
      const raw = result.response.text().trim();
      console.log(`[GoogleGeminiDriver] Raw response text:`, raw);
      if (!raw) throw new Error("Respuesta IA vacía");
      return { data: JSON.parse(raw) as T, usage };
    } catch (structuredError) {
      console.error("[GoogleGeminiDriver] Error during structured JSON generation:", structuredError);
      try {
        console.log("[GoogleGeminiDriver] Falling back to generateText with raw prompt + extraction rules...");
        const { text, usage } = await this.generateText(
          apiKey,
          model,
          `${prompt}\n\nResponde únicamente con JSON válido, sin markdown.`,
          options
        );
        console.log(`[GoogleGeminiDriver] Fallback raw response text:`, text);
        const extracted = extractJsonObject(text);
        console.log(`[GoogleGeminiDriver] Extracted JSON string:`, extracted);
        return { data: JSON.parse(extracted) as T, usage };
      } catch (fallbackError) {
        console.error("[GoogleGeminiDriver] Fallback JSON generation also failed:", fallbackError);
        throw structuredError instanceof Error
          ? structuredError
          : new Error("Error al generar JSON con Gemini");
      }
    }
  }
}

/**
 * Driver OpenAI Compatible para Groq, OpenRouter y otros compatibles
 */
export class OpenAiCompatibleDriver implements AiDriver {
  constructor(private providerCode: string) { }

  private getEndpointUrl(): string {
    if (this.providerCode === "groq") {
      return "https://api.groq.com/openai/v1/chat/completions";
    }
    if (this.providerCode === "openrouter") {
      return "https://openrouter.ai/api/v1/chat/completions";
    }
    return `https://api.${this.providerCode}.com/v1/chat/completions`;
  }

  async generateText(
    apiKey: string,
    model: string,
    prompt: string,
    options?: { maxTokens?: number }
  ): Promise<{ text: string; usage: TokenUsage }> {
    return this.callHttp(apiKey, model, prompt, false, options);
  }

  async generateJson<T>(
    apiKey: string,
    model: string,
    prompt: string,
    schema: ResponseSchema,
    options?: { maxTokens?: number }
  ): Promise<{ data: T; usage: TokenUsage }> {
    try {
      const result = await this.callHttp(apiKey, model, prompt, true, options);
      const raw = result.text.trim();
      if (!raw) throw new Error("Respuesta IA vacía");
      return { data: JSON.parse(extractJsonObject(raw)) as T, usage: result.usage };
    } catch (structuredError) {
      try {
        const result = await this.callHttp(
          apiKey,
          model,
          `${prompt}\n\nResponde únicamente con JSON válido, sin markdown.`,
          false,
          options
        );
        return { data: JSON.parse(extractJsonObject(result.text)) as T, usage: result.usage };
      } catch {
        throw structuredError instanceof Error
          ? structuredError
          : new Error(`Error al generar JSON con el proveedor ${this.providerCode}`);
      }
    }
  }

  private async callHttp(
    apiKey: string,
    model: string,
    prompt: string,
    isJson: boolean,
    options?: { maxTokens?: number }
  ): Promise<{ text: string; usage: TokenUsage }> {
    const endpoint = this.getEndpointUrl();
    console.log(`[OpenAiCompatibleDriver] callHttp starting. Endpoint: ${endpoint}, Model: ${model}, isJson: ${isJson}`);

    // 1. Estructura Estricta de Headers
    const headers: Record<string, string> = {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Estelar KPIs System"
    };

    // Modo JSON Forzado: añade regla al final del prompt. Si es Groq, requiere frase exacta.
    let finalPrompt = prompt;
    if (isJson) {
      if (this.providerCode === "groq") {
        finalPrompt = `${prompt}\n\nResponse must be a valid JSON object.`;
      } else {
        finalPrompt = `${prompt}\n\nREGLA: Debes retornar estrictamente una cadena JSON válida.`;
      }
    }

    // Cuerpo clásico de mensajes: [{ "role": "user", "content": promptText }]
    const messages = [
      { role: "user", content: finalPrompt }
    ];

    // 3. Estructura Estricta del Payload HTTP Body
    const body: Record<string, any> = {
      model: model,
      messages: messages
    };

    // Parámetros adicionales estándar
    body.temperature = 0.4;
    body.max_tokens = options?.maxTokens ?? 1024;

    // Modo JSON Forzado: response_format en el body
    if (isJson) {
      body.response_format = { type: "json_object" };
    }

    console.log(`[OpenAiCompatibleDriver] Request Body:`, JSON.stringify(body));

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
    } catch (netError) {
      console.error(`[OpenAiCompatibleDriver] Network connection failed for ${this.providerCode}:`, netError);
      throw new Error(
        `[Error de Red del Proveedor - ${this.providerCode}] No se pudo conectar con la API del proveedor de IA: ${netError instanceof Error ? netError.message : String(netError)}`
      );
    }

    console.log(`[OpenAiCompatibleDriver] HTTP Response Status: ${response.status} ${response.statusText}`);

    // Validación de estado con captura del Payload de error
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI_ROUTE_ERROR] Proveedor falló con estatus ${response.status}:`, errorText);
      throw new Error(`Error de API externa: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[OpenAiCompatibleDriver] Response JSON payload:`, JSON.stringify(result));

    // 4. Normalización del Retorno y Mapeo de Tokens
    // IMPORTANTE: Los modelos de razonamiento (p.ej. openai/gpt-oss-120b) consumen
    // tokens para pensar internamente ANTES de producir content. Si finish_reason=="length",
    // significa que el modelo agotó el presupuesto sin llegar a escribir content.
    // En ese caso lanzamos un error claro en vez de retornar el texto de razonamiento interno.
    const choice = result.choices?.[0];
    const finishReason = choice?.finish_reason ?? "";
    const text: string = typeof choice?.message?.content === "string"
      ? choice.message.content
      : "";

    if (!text.trim() && finishReason === "length") {
      throw new Error(
        `El modelo ${model} agotó el presupuesto de tokens (finish_reason=length) sin producir contenido. ` +
        `Aumenta max_tokens o usa un modelo sin razonamiento extendido.`
      );
    }

    const promptTokens = result.usage?.prompt_tokens ?? 0;
    const completionTokens = result.usage?.completion_tokens ?? 0;
    const totalTokens = result.usage?.total_tokens ?? 0;

    const usage: TokenUsage = {
      promptTokenCount: promptTokens,
      candidatesTokenCount: completionTokens,
      totalTokenCount: totalTokens,
      promptTokens,
      completionTokens,
      totalTokens
    };

    console.log(`[OpenAiCompatibleDriver] callHttp successful. Content: "${text.substring(0, 100)}..."`);
    return { text, usage };
  }
}

/**
 * Factory para resolver el Driver correspondiente
 */
export function getDriverForProvider(providerCode: string): AiDriver {
  if (providerCode === "google_gemini") {
    return new GoogleGeminiDriver();
  }
  return new OpenAiCompatibleDriver(providerCode);
}

// =============================================================================
// API PÚBLICA — funciones con API Key explícita y ruteo dinámico
// =============================================================================

function getFallbackModel(providerCode: string): string {
  switch (providerCode) {
    case "groq":
      return "llama3-8b-8192";
    case "google_gemini":
      return "gemini-1.5-flash";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-sonnet-latest";
    case "openrouter":
      return "google/gemini-2.5-flash";
    default:
      return "gemini-1.5-flash";
  }
}

/**
 * Genera texto usando una API Key explícita y ruteo dinámico.
 */
export async function generateTextWithKey(
  apiKey: string,
  provider: string,
  model: string | null | undefined,
  prompt: string,
  options?: { maxTokens?: number }
): Promise<{ text: string; usage: TokenUsage }> {
  const activeModel = model && model.trim() ? model.trim() : getFallbackModel(provider);
  const driver = getDriverForProvider(provider);
  return driver.generateText(apiKey, activeModel, prompt, options);
}

/**
 * Genera JSON estructurado usando una API Key explícita y ruteo dinámico.
 */
export async function generateJsonWithKey<T>(
  apiKey: string,
  provider: string,
  model: string | null | undefined,
  prompt: string,
  schema: ResponseSchema,
  options?: { maxTokens?: number }
): Promise<{ data: T; usage: TokenUsage }> {
  const activeModel = model && model.trim() ? model.trim() : getFallbackModel(provider);
  const driver = getDriverForProvider(provider);
  return driver.generateJson<T>(apiKey, activeModel, prompt, schema, options);
}

// =============================================================================
// API LEGACY — wrappers de retro-compatibilidad (usan process.env)
// =============================================================================

export async function generateText(
  prompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  try {
    const resolved = await resolveActiveAiKey();
    const model = resolved.modeloDefecto || getFallbackModel(resolved.providerCode);
    const { text } = await generateTextWithKey(
      resolved.apiKey,
      resolved.providerCode,
      model,
      prompt,
      options
    );
    return text;
  } catch (err) {
    console.warn("[universal-client] Fallback to process.env due to:", err);
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("No hay configuración de IA activa en la base de datos ni variable de entorno GEMINI_API_KEY");
    }
    const model = getGeminiModel();
    const { text } = await generateTextWithKey(key, "google_gemini", model, prompt, options);
    return text;
  }
}

export async function generateJson<T>(
  prompt: string,
  schema: ResponseSchema,
  options?: { maxTokens?: number }
): Promise<T> {
  try {
    const resolved = await resolveActiveAiKey();
    const model = resolved.modeloDefecto || getFallbackModel(resolved.providerCode);
    const { data } = await generateJsonWithKey<T>(
      resolved.apiKey,
      resolved.providerCode,
      model,
      prompt,
      schema,
      options
    );
    return data;
  } catch (err) {
    console.warn("[universal-client] Fallback to process.env due to:", err);
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("No hay configuración de IA activa en la base de datos ni variable de entorno GEMINI_API_KEY");
    }
    const model = getGeminiModel();
    const { data } = await generateJsonWithKey<T>(key, "google_gemini", model, prompt, schema, options);
    return data;
  }
}

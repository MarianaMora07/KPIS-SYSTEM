import {
  GoogleGenerativeAI,
  type GenerateContentResult,
  type ResponseSchema,
} from "@google/generative-ai";

/** Modelos verificados en API v1beta (jun 2026) */
const MODEL_CANDIDATES = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

type GeminiGenerationConfig = {
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: ResponseSchema;
  thinkingConfig?: { thinkingBudget?: number };
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

function getModelWithName(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
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

async function generateContentWithRetry(
  request: Parameters<ReturnType<typeof getModelWithName>["generateContent"]>[0],
  options?: { maxTokens?: number; temperature?: number },
  extra?: Pick<GeminiGenerationConfig, "responseMimeType" | "responseSchema">
): Promise<GenerateContentResult> {
  const models = getModelCandidates();
  let lastError: unknown;

  for (const modelName of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const model = getModelWithName(modelName);
        const result = await model.generateContent({
          ...request,
          generationConfig: buildGenerationConfig(modelName, options, extra),
        });
        assertCompleteResponse(result);
        return result;
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

export async function generateText(
  prompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const result = await generateContentWithRetry(
    { contents: [{ role: "user", parts: [{ text: prompt }] }] },
    { maxTokens: options?.maxTokens ?? 1024 }
  );
  return result.response.text();
}

export async function generateJson<T>(
  prompt: string,
  schema: ResponseSchema,
  options?: { maxTokens?: number }
): Promise<T> {
  try {
    const result = await generateContentWithRetry(
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      { maxTokens: options?.maxTokens ?? 1024 },
      { responseMimeType: "application/json", responseSchema: schema }
    );
    const raw = result.response.text().trim();
    if (!raw) throw new Error("Respuesta IA vacía");
    return JSON.parse(raw) as T;
  } catch (structuredError) {
    try {
      const plain = await generateText(
        `${prompt}\n\nResponde únicamente con JSON válido, sin markdown.`,
        options
      );
      return JSON.parse(extractJsonObject(plain)) as T;
    } catch {
      throw structuredError instanceof Error
        ? structuredError
        : new Error("Error al generar JSON con Gemini");
    }
  }
}

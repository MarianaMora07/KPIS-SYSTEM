import {
  GoogleGenerativeAI,
  type ResponseSchema,
} from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

type GeminiGenerationConfig = {
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: ResponseSchema;
  thinkingConfig?: { thinkingBudget?: number };
};

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function buildGenerationConfig(
  options?: { maxTokens?: number; temperature?: number },
  extra?: Pick<GeminiGenerationConfig, "responseMimeType" | "responseSchema">
): GeminiGenerationConfig {
  const model = getGeminiModel();
  const config: GeminiGenerationConfig = {
    maxOutputTokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.4,
    ...extra,
  };

  if (/gemini-2\.5-flash(?!-lite)/.test(model)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  return config;
}

function toUserFacingError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("429") || /quota exceeded/i.test(message)) {
    if (/limit:\s*0/i.test(message) || /gemini-2\.0/i.test(message)) {
      return new Error(
        "El modelo Gemini configurado ya no está disponible en el plan gratuito. Actualice GEMINI_MODEL (p. ej. gemini-2.5-flash-lite) en .env.local."
      );
    }
    return new Error(
      "Cuota de Gemini agotada. Espere un minuto o revise su plan en Google AI Studio."
    );
  }

  if (message.includes("503") || /high demand/i.test(message)) {
    return new Error(
      "Gemini está saturado temporalmente. Intente de nuevo en unos segundos."
    );
  }

  if (message.includes("404") || /not found/i.test(message)) {
    return new Error(
      `Modelo Gemini no encontrado (${getGeminiModel()}). Verifique GEMINI_MODEL en .env.local.`
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: getGeminiModel() });
}

function assertCompleteResponse(
  result: Awaited<ReturnType<ReturnType<typeof getModel>["generateContent"]>>
) {
  const finishReason = result.response.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "La respuesta de Gemini se truncó. Intente de nuevo o use gemini-2.5-flash-lite."
    );
  }
}

export async function generateText(
  prompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const model = getModel();

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: buildGenerationConfig({
        maxTokens: options?.maxTokens ?? 1024,
      }),
    });

    assertCompleteResponse(result);
    return result.response.text();
  } catch (error) {
    throw toUserFacingError(error);
  }
}

export async function generateJson<T>(
  prompt: string,
  schema: ResponseSchema,
  options?: { maxTokens?: number }
): Promise<T> {
  const model = getModel();

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: buildGenerationConfig(
        { maxTokens: options?.maxTokens ?? 1024 },
        { responseMimeType: "application/json", responseSchema: schema }
      ),
    });

    assertCompleteResponse(result);

    const raw = result.response.text().trim();
    if (!raw) {
      throw new Error("Respuesta IA vacía");
    }

    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Respuesta IA inválida");
    }
    throw toUserFacingError(error);
  }
}

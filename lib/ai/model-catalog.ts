/**
 * lib/ai/model-catalog.ts
 *
 * Catálogo estático de modelos de Inteligencia Artificial
 * soportados por el sistema (Google Gemini, Groq y OpenRouter).
 */

export interface ModelCatalogEntry {
  providerCode: string;
  codigo: string;
  nombre: string;
  estado: "activo" | "inactivo";
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // Google Gemini
  { providerCode: "google_gemini", codigo: "gemini-1.5-flash", nombre: "Gemini 1.5 Flash", estado: "activo" },
  { providerCode: "google_gemini", codigo: "gemini-1.5-pro", nombre: "Gemini 1.5 Pro", estado: "activo" },
  { providerCode: "google_gemini", codigo: "gemini-2.5-flash", nombre: "Gemini 2.5 Flash", estado: "activo" },
  { providerCode: "google_gemini", codigo: "gemini-2.5-flash-lite", nombre: "Gemini 2.5 Flash Lite", estado: "activo" },

  // Groq
  { providerCode: "groq", codigo: "llama-3.1-8b-instant", nombre: "Llama 3.1 8B Instant (Groq)", estado: "activo" },
  { providerCode: "groq", codigo: "llama-3.3-70b-versatile", nombre: "Llama 3.3 70B Versatile (Groq)", estado: "activo" },
  { providerCode: "groq", codigo: "llama3-8b-8192", nombre: "Llama 3 8B (Groq)", estado: "activo" },
  { providerCode: "groq", codigo: "llama3-70b-8192", nombre: "Llama 3 70B (Groq)", estado: "activo" },
  { providerCode: "groq", codigo: "mixtral-8x7b-32768", nombre: "Mixtral 8x7B (Groq)", estado: "activo" },
  { providerCode: "groq", codigo: "gemma2-9b-it", nombre: "Gemma 2 9B (Groq)", estado: "activo" },

  // OpenRouter
  { providerCode: "openrouter", codigo: "meta-llama/llama-3.3-70b-versatile", nombre: "Llama 3.3 70B Versatile (OpenRouter)", estado: "activo" },
  { providerCode: "openrouter", codigo: "meta-llama/llama-3.1-8b-instruct", nombre: "Llama 3.1 8B Instruct (OpenRouter)", estado: "activo" },
  { providerCode: "openrouter", codigo: "google/gemini-2.5-flash", nombre: "Gemini 2.5 Flash (OpenRouter)", estado: "activo" },
  { providerCode: "openrouter", codigo: "google/gemini-2.5-pro", nombre: "Gemini 2.5 Pro (OpenRouter)", estado: "activo" },
  { providerCode: "openrouter", codigo: "anthropic/claude-3.5-sonnet", nombre: "Claude 3.5 Sonnet (OpenRouter)", estado: "activo" },
  { providerCode: "openrouter", codigo: "deepseek/deepseek-chat", nombre: "DeepSeek V3 (OpenRouter)", estado: "activo" },
  { providerCode: "openrouter", codigo: "meta-llama/llama-3-70b-instruct", nombre: "Llama 3 70B Instruct (OpenRouter)", estado: "activo" },
];

/**
 * Retorna los modelos estáticos filtrados por código de proveedor.
 */
export function getStaticModelsByProvider(providerCode: string): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((m) => m.providerCode === providerCode && m.estado === "activo");
}

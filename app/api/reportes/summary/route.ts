import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTextWithKey } from "@/lib/ai/universal-client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { resolveActiveAiKey } from "@/lib/ai/key-resolver";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const summarySchema = z.object({
  rows: z.array(
    z.object({
      kpi_nombre: z.string(),
      hotel_nombre: z.string().nullable().optional(),
      valor_real: z.number(),
      valor_meta: z.number().nullable().optional(),
      cumplimiento_pct: z.number().nullable().optional(),
      semaforo_calculado: z.string().nullable().optional(),
    })
  ),
  filters: z
    .object({
      periodo: z.string().optional(),
      region: z.string().optional(),
      hotel: z.string().optional(),
    })
    .optional(),
});

/**
 * Inserta un registro de uso en ai_usage_logs de forma silenciosa.
 * Nunca bloquea ni lanza excepciones hacia el caller.
 */
async function logAiUsage(payload: {
  configurationId: string;
  usuarioId: string | null;
  moduloOrigen: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensTotal: number;
}): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return;

    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await adminClient.from("ai_usage_logs").insert({
      configuration_id: payload.configurationId,
      usuario_id: payload.usuarioId,
      modulo_origen: payload.moduloOrigen,
      prompt_tokens: payload.tokensEntrada,
      completion_tokens: payload.tokensSalida,
      total_tokens: payload.tokensTotal,
    });
  } catch (err) {
    // Error silencioso: el logging nunca debe interrumpir la respuesta al usuario
    console.error("[ai_usage_logs] Fallo silencioso al registrar uso:", err);
  }
}

export async function POST(request: Request) {
  // ── Paso 1: Obtener la API Key activa desde la base de datos ──────────────
  let apiKey: string;
  let configurationId: string;
  let providerCode: string;
  let modeloDefecto: string;

  try {
    const resolved = await resolveActiveAiKey();
    apiKey = resolved.apiKey;
    configurationId = resolved.configurationId;
    providerCode = resolved.providerCode;
    modeloDefecto = resolved.modeloDefecto;
  } catch (keyError) {
    console.error("[reportes/summary] No se pudo resolver la API Key de IA:", keyError);
    return NextResponse.json({ summary: null });
  }

  // Fallback seguro si modeloDefecto llega vacío o nulo
  let model = modeloDefecto;
  if (!model) {
    switch (providerCode) {
      case "groq":
        model = "llama3-8b-8192";
        break;
      case "google_gemini":
        model = "gemini-1.5-flash";
        break;
      case "openai":
        model = "gpt-4o-mini";
        break;
      case "anthropic":
        model = "claude-3-5-sonnet-latest";
        break;
      default:
        model = "gemini-1.5-flash";
        break;
    }
  }


  // ── Obtener usuario de la sesión Supabase ─────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const rateKey = `summary:${user?.id ?? "anon"}`;
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json({ summary: null });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = summarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { rows, filters } = parsed.data;
  if (rows.length === 0) {
    return NextResponse.json({ summary: "Sin datos para analizar." });
  }

  const dataSummary = rows
    .slice(0, 20)
    .map(
      (r) =>
        `- ${r.kpi_nombre} (${r.hotel_nombre ?? "N/A"}): real=${r.valor_real}, meta=${r.valor_meta ?? "N/A"}, cumplimiento=${r.cumplimiento_pct ?? "N/A"}%, estado=${r.semaforo_calculado ?? "N/A"}`
    )
    .join("\n");

  const prompt = `Eres analista ejecutivo de Hoteles Estelar. Redacta un párrafo de resumen ejecutivo (máximo 120 palabras) en español para un reporte PDF de KPIs.

Filtros: ${JSON.stringify(filters ?? {})}

Datos:
${dataSummary}

Destaca brechas críticas y tendencias. Sé conciso y profesional. Sin viñetas.`;

  try {
    // ── Paso 2: Generar resumen con API Key dinámica ───────────────────────
    const { text: summary, usage } = await generateTextWithKey(
      apiKey,
      providerCode,
      model,
      prompt,
      { maxTokens: 300 }
    );

    // ── Paso 3 & 4: Log silencioso de tokens (no bloquea el retorno) ─────
    logAiUsage({
      configurationId,
      usuarioId: user?.id ?? null,
      moduloOrigen: "sugerencias_kpi",
      tokensEntrada: usage.promptTokenCount,
      tokensSalida: usage.candidatesTokenCount,
      tokensTotal: usage.totalTokenCount,
    }).catch(() => {
      // Silencioso: ya manejado dentro de logAiUsage
    });

    return NextResponse.json({ summary: summary.trim() });
  } catch (error) {
    console.error("[reportes/summary] Gemini error:", error);
    return NextResponse.json({ summary: null });
  }
}

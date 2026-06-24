import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTextWithKey } from "@/lib/ai/universal-client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { resolveActiveAiKey } from "@/lib/ai/key-resolver";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// ── Input schema ──────────────────────────────────────────────────────────────
const translateFormulaSchema = z.object({
  descripcion: z.string().min(5, "La descripción debe tener al menos 5 caracteres"),
  variables: z
    .array(
      z.object({
        codigo: z.string(),
        nombre: z.string(),
      })
    )
    .min(1, "Debe enviar al menos una variable"),
});

// ── Silent usage logger ───────────────────────────────────────────────────────
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
    console.error("[ai_usage_logs] Fallo silencioso al registrar uso:", err);
  }
}

// ── Strip any accidental markdown or explanation from Gemini's output ─────────
function cleanFormulaOutput(raw: string): string {
  // Remove fenced code blocks
  let cleaned = raw.replace(/```[\w]*\n?/g, "").replace(/```/g, "");
  // Remove any line that starts with a word followed by colon (explanation lines)
  cleaned = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // Keep only the first non-empty line that looks like a formula
    .find((l) => /^[\w\s()+\-*/^%.]+$/.test(l)) ?? cleaned.split("\n")[0] ?? "";
  return cleaned.trim();
}

// ── POST /api/kpis/translate-formula ─────────────────────────────────────────
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = translateFormulaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { descripcion, variables } = parsed.data;

  // ── Resolve active AI key ─────────────────────────────────────────────────
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
    console.error("[translate-formula] No se pudo resolver la API Key de IA:", keyError);
    return NextResponse.json(
      { error: "Servicio de IA no disponible. Configure una clave activa en Administración." },
      { status: 503 }
    );
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


  // ── Rate limiting ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const rateKey = `translate-formula:${user?.id ?? request.headers.get("x-forwarded-for") ?? "anon"}`;
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espere un momento e intente de nuevo." },
      { status: 429 }
    );
  }

  // ── Build Gemini prompt ───────────────────────────────────────────────────
  const variableList = variables
    .map((v) => `  - Código: ${v.codigo}  |  Nombre: ${v.nombre}`)
    .join("\n");

  const prompt = `Eres un parser matemático estricto para un sistema de KPIs hotelero.

Tu única tarea es convertir la descripción en lenguaje natural a una expresión matemática usando EXCLUSIVAMENTE los códigos de variable proporcionados.

Variables disponibles:
${variableList}

Descripción en lenguaje natural:
"${descripcion}"

REGLAS ABSOLUTAS:
1. Responde ÚNICAMENTE con la expresión matemática, sin explicaciones, sin markdown, sin comillas, sin texto adicional.
2. Usa solo los códigos de variable exactos (ej. reservas_web, visitas_mes).
3. Operadores permitidos: + - * / ( ) ^ %
4. Ejemplo de respuesta válida: (reservas_web / visitas_mes) * 100
5. Si la descripción no puede expresarse con las variables dadas, responde solo con: ERROR_VARIABLES_INSUFICIENTES`;

  try {
    const { text: raw, usage } = await generateTextWithKey(
      apiKey,
      providerCode,
      model,
      prompt,
      { maxTokens: 200 }
    );

    const formula = cleanFormulaOutput(raw);

    if (!formula || formula === "ERROR_VARIABLES_INSUFICIENTES") {
      return NextResponse.json(
        {
          error:
            "La IA no pudo generar la fórmula con las variables disponibles. Revise la descripción o agregue más variables.",
        },
        { status: 422 }
      );
    }

    // ── Log usage silently ──────────────────────────────────────────────────
    logAiUsage({
      configurationId,
      usuarioId: user?.id ?? null,
      moduloOrigen: "traductor_formulas",
      tokensEntrada: usage.promptTokenCount,
      tokensSalida: usage.candidatesTokenCount,
      tokensTotal: usage.totalTokenCount,
    }).catch(() => { });

    return NextResponse.json({ formula });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar fórmula";
    console.error("[kpis/translate-formula] Gemini error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

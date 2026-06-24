import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateJsonWithKey } from "@/lib/ai/universal-client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { resolveActiveAiKey } from "@/lib/ai/key-resolver";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const actionPlanSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    titulo: { type: SchemaType.STRING },
    descripcion: { type: SchemaType.STRING },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { descripcion: { type: SchemaType.STRING } },
        required: ["descripcion"],
      },
    },
  },
  required: ["titulo", "descripcion", "items"],
};

const suggestSchema = z.object({
  kpi_nombre: z.string().min(1),
  hotel: z.string().optional(),
  valor_real: z.number().optional(),
  valor_meta: z.number().optional(),
  semaforo: z.enum(["cumplimiento", "riesgo", "incumplimiento"]).optional(),
});

function buildFallbackPlan(
  kpiNombre: string,
  hotel?: string,
  semaforo?: string
) {
  const scope = hotel ? ` en ${hotel}` : "";
  const estado = semaforo ?? "incumplimiento";
  return {
    titulo: `Plan correctivo — ${kpiNombre}`.slice(0, 200),
    descripcion: `Acciones para revertir el estado de ${estado} del KPI ${kpiNombre}${scope}. Priorizar diagnóstico de causas, medidas inmediatas y seguimiento semanal hasta recuperar la meta.`,
    items: [
      { descripcion: `Revisar datos y validar el valor reportado de ${kpiNombre}` },
      { descripcion: "Identificar causas raíz con el equipo responsable del área" },
      { descripcion: "Definir acciones correctivas con responsable y fecha límite" },
      { descripcion: "Monitorear avance semanal hasta volver a zona de cumplimiento" },
    ],
    fallback: true,
  };
}

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = suggestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { kpi_nombre, hotel, valor_real, valor_meta, semaforo } = parsed.data;

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
    console.log("providerCode:", providerCode, "modeloDefecto:", modeloDefecto);
  } catch (keyError) {
    console.error("[suggest-plan] No se pudo resolver la API Key de IA:", keyError);
    return NextResponse.json(buildFallbackPlan(kpi_nombre, hotel, semaforo));
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

  const rateKey = user?.id ?? request.headers.get("x-forwarded-for") ?? "anon";
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(buildFallbackPlan(kpi_nombre, hotel, semaforo));
  }

  const prompt = `Eres un consultor de hotelería para Hoteles Estelar en Colombia.
Genera un plan de acción correctivo en JSON válido (sin markdown) para el siguiente KPI en incumplimiento o riesgo:

KPI: ${kpi_nombre}
Hotel: ${hotel ?? "No especificado"}
Valor actual: ${valor_real ?? "N/A"}
Meta: ${valor_meta ?? "N/A"}
Estado semáforo: ${semaforo ?? "incumplimiento"}

Responde ÚNICAMENTE con este JSON:
{
  "titulo": "string (máx 100 caracteres)",
  "descripcion": "string (2-3 oraciones con acciones concretas)",
  "items": [{"descripcion": "string acción específica"}]
}

Incluye 3 a 5 ítems accionables. No inventes cifras ni datos no proporcionados.`;

  try {
    // ── Paso 2: Generar sugerencia con API Key dinámica ───────────────────
    const { data: plan, usage } = await generateJsonWithKey<{
      titulo: string;
      descripcion: string;
      items: { descripcion: string }[];
    }>(apiKey, providerCode, model, prompt, actionPlanSchema, { maxTokens: 1024 });

    // ── Paso 3 & 4: Log silencioso de tokens (no bloquea el retorno) ──────
    logAiUsage({
      configurationId,
      usuarioId: user?.id ?? null,
      moduloOrigen: "generacion_planes_accion",
      tokensEntrada: usage.promptTokenCount,
      tokensSalida: usage.candidatesTokenCount,
      tokensTotal: usage.totalTokenCount,
    }).catch(() => {
      // Silencioso: ya manejado dentro de logAiUsage
    });

    return NextResponse.json({
      titulo: String(plan.titulo).slice(0, 200),
      descripcion: String(plan.descripcion).slice(0, 2000),
      items: (plan.items ?? []).slice(0, 8).map((i) => ({
        descripcion: String(i.descripcion).slice(0, 500),
      })),
      fallback: false,
    });
  } catch (error) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(buildFallbackPlan(kpi_nombre, hotel, semaforo));
  }
}

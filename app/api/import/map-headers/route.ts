import { NextResponse } from "next/server";
import { z } from "zod";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { generateJsonWithKey } from "@/lib/ai/universal-client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { resolveActiveAiKey } from "@/lib/ai/key-resolver";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// ── Input schema ──────────────────────────────────────────────────────────────
const mapHeadersSchema = z.object({
  headers: z
    .array(z.string())
    .min(1, "Debe enviar al menos una cabecera del archivo"),
  kpis: z
    .array(
      z.object({
        codigo: z.string(),
        nombre: z.string(),
      })
    )
    .optional(),
  targetColumns: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      })
    )
    .optional(),
});

// ── JSON schema for Gemini structured output ──────────────────────────────────
function buildMappingSchema(headers: string[]): ResponseSchema {
  const props: Record<string, ResponseSchema> = {};
  for (const h of headers) {
    props[h] = { type: SchemaType.STRING };
  }
  return {
    type: SchemaType.OBJECT,
    properties: props,
  };
}

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

// ── POST /api/import/map-headers ──────────────────────────────────────────────
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = mapHeadersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { headers, kpis, targetColumns } = parsed.data;

  if (!kpis && !targetColumns) {
    return NextResponse.json(
      { error: "Debe enviar 'kpis' o 'targetColumns' en el cuerpo de la solicitud" },
      { status: 400 }
    );
  }

  // ── Resolve active AI key ─────────────────────────────────────────────────
  let apiKey: string;
  let configurationId: string;
  let providerCode: string;
  let modeloDefecto: string;

  console.log(
    "[Server map-headers] Received request headers:",
    headers,
    "targetColumns count:",
    targetColumns?.length ?? 0,
    "kpis count:",
    kpis?.length ?? 0
  );

  try {
    const resolved = await resolveActiveAiKey();
    apiKey = resolved.apiKey;
    configurationId = resolved.configurationId;
    providerCode = resolved.providerCode;
    modeloDefecto = resolved.modeloDefecto;
    console.log("[Server map-headers] resolveActiveAiKey resolved successfully:", {
      configurationId,
      providerCode,
      modeloDefecto,
      apiKeyMasked: apiKey ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` : "empty",
    });
  } catch (keyError) {
    console.error("[Server map-headers] No se pudo resolver la API Key de IA:", keyError);
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
  console.log("[Server map-headers] Selected model to run:", model);

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const rateKey = `map-headers:${user?.id ?? request.headers.get("x-forwarded-for") ?? "anon"}`;
  const isAllowed = checkRateLimit(rateKey);
  console.log(`[Server map-headers] Rate limit check for key '${rateKey}':`, isAllowed ? "ALLOWED" : "BLOCKED");
  if (!isAllowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espere un momento e intente de nuevo." },
      { status: 429 }
    );
  }

  // ── Build Gemini/IA prompt ─────────────────────────────────────────────────
  const headerList = headers.map((h) => `  - "${h}"`).join("\n");
  
  let systemCatalogText = "";
  let absoluteRulesText = "";
  let exampleResponse = "";
  let validCodes: Set<string>;

  if (targetColumns && targetColumns.length > 0) {
    const targetList = targetColumns
      .map((c) => `  - Código/Columna: ${c.value}  |  Descripción: ${c.label}`)
      .join("\n");
    
    systemCatalogText = `Columnas destino del sistema de KPIs:\n${targetList}`;
    absoluteRulesText = `El VALOR es el código/nombre de la columna destino del sistema que mejor coincide semánticamente (ej. "kpi_codigo", "fecha", "valor_real", "hotel_codigo", "valor_meta", "var_visitas_mes", etc.).`;
    exampleResponse = `{"ID_Indicador": "kpi_codigo", "Fecha_Registro": "fecha", "Registro_Actual": "valor_real", "Sucursal_Codigo": "hotel_codigo", "Meta_Fijada": "valor_meta"}`;
    validCodes = new Set(targetColumns.map((c) => c.value));
  } else {
    // Fallback logic for legacy KPI catalog mapping
    const kpiList = (kpis ?? [])
      .map((k) => `  - Código: ${k.codigo}  |  Nombre: ${k.nombre}`)
      .join("\n");
    
    systemCatalogText = `KPIs activos en el catálogo:\n${kpiList}`;
    absoluteRulesText = `El VALOR es el código del KPI que mejor coincide semánticamente (ej. "OCP-001").`;
    exampleResponse = `{"Ocupacion_Mayo": "OCP-001", "Ingresos_Hab": "REV-002", "ColumnaRara": ""}`;
    validCodes = new Set((kpis ?? []).map((k) => k.codigo));
  }

  const prompt = `Eres un asistente de mapeo de datos para un sistema de KPIs hotelero.

Tu tarea es analizar la similitud semántica entre las CABECERAS de un archivo Excel importado y las columnas/KPIs de destino en nuestro sistema, y devolver el mejor mapeo posible.

Cabeceras del archivo Excel:
${headerList}

${systemCatalogText}

REGLAS ABSOLUTAS:
1. Devuelve ESTRICTAMENTE un objeto JSON donde:
   - La CLAVE es exactamente la cabecera del archivo Excel (conserva mayúsculas/minúsculas/caracteres originales).
   - ${absoluteRulesText}
   - Si una cabecera NO tiene coincidencia semántica razonable con ningún destino, usa el valor "" (cadena vacía).
2. Sin markdown, sin explicaciones, sin texto adicional. Solo el JSON.
3. Ejemplo de respuesta válida:
   ${exampleResponse}`;

  console.log("[Server map-headers] Generated prompt:\n", prompt);

  const schema = buildMappingSchema(headers);

  try {
    console.log("[Server map-headers] Calling generateJsonWithKey...");
    const { data: mapping, usage } = await generateJsonWithKey<
      Record<string, string>
    >(apiKey, providerCode, model, prompt, schema, { maxTokens: 512 });
    
    console.log("[Server map-headers] generateJsonWithKey returned mapping:", mapping);
    console.log("[Server map-headers] Token usage metadata:", usage);

    // Validate that all keys are present and values are valid KPI codes / target columns or ""
    const cleanMapping: Record<string, string> = {};
    for (const header of headers) {
      const suggested = mapping[header] ?? "";
      cleanMapping[header] = validCodes.has(suggested) ? suggested : "";
    }
    console.log("[Server map-headers] Cleaned mapping validation results:", cleanMapping);

    // ── Log usage silently ──────────────────────────────────────────────────
    logAiUsage({
      configurationId,
      usuarioId: user?.id ?? null,
      moduloOrigen: "mapeo_columnas_excel",
      tokensEntrada: usage.promptTokenCount,
      tokensSalida: usage.candidatesTokenCount,
      tokensTotal: usage.totalTokenCount,
    }).catch((err) => { 
      console.error("[Server map-headers] Silent logAiUsage failed:", err);
    });

    const mappedCount = Object.values(cleanMapping).filter(Boolean).length;
    console.log(`[Server map-headers] Responding successfully. Mapped count: ${mappedCount}`);
    return NextResponse.json({ mapping: cleanMapping, mappedCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al mapear cabeceras";
    console.error("[Server map-headers] Catch-all route error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

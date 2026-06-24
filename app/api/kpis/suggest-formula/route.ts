import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateJson, isGeminiConfigured } from "@/lib/gemini/client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { suggestKpiFormulaFallback } from "@/lib/kpis/suggest-formula-fallback";
import { assertPermission } from "@/lib/auth/require-permission";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const requestSchema = z.object({
  kpi_nombre: z.string().min(1).max(200),
  unidad_medida: z.string().max(50).optional(),
  area_responsable: z.string().max(150).optional(),
  tipo_indicador: z.enum(["estrategico", "tactico", "operativo"]).optional(),
  variables: z
    .array(
      z.object({
        codigo: z.string().min(1),
        nombre: z.string().min(1),
        tipo: z.string(),
      })
    )
    .max(80),
});

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    expresion: { type: SchemaType.STRING },
    variable_codes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    reason: { type: SchemaType.STRING },
  },
  required: ["expresion", "variable_codes", "reason"],
};

type GeminiFormulaSuggestion = {
  expresion: string;
  variable_codes: string[];
  reason: string;
};

function buildFallbackResponse(
  input: z.infer<typeof requestSchema>
): GeminiFormulaSuggestion & { fallback: boolean } {
  const fallback = suggestKpiFormulaFallback(input);
  if (fallback) {
    return { ...fallback, fallback: true };
  }
  return {
    expresion: "",
    variable_codes: [],
    reason:
      input.variables.length === 0
        ? "Cree variables en el catálogo (por ejemplo visitas_mes y reservas_web) y vuelva a solicitar una sugerencia."
        : "No hay una plantilla automática para este indicador. Describa el KPI con más detalle o cree variables alineadas al cálculo.",
    fallback: true,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const input = parsed.data;

  try {
    await assertPermission("kpis.editar");
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(buildFallbackResponse(input));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rateKey = user.id;
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(buildFallbackResponse(input));
  }

  const variableList =
    input.variables.length > 0
      ? input.variables.map((v) => `- ${v.codigo} (${v.nombre}, ${v.tipo})`).join("\n")
      : "(sin variables en catálogo)";

  const prompt = `Eres un experto en KPIs hoteleros y de mercadeo para Hoteles Estelar (Colombia).

Sugiere UNA fórmula matemática para calcular el indicador comercial descrito.
Reglas estrictas:
- Use SOLO códigos de variables listadas abajo (identificadores exactos, sin espacios).
- Operadores permitidos: +, -, *, /, paréntesis y números.
- No use funciones ni texto libre dentro de la expresión.
- Si ninguna variable del catálogo sirve, devuelva expresion vacía y explique qué variables crear.
- La unidad del KPI es "${input.unidad_medida ?? "no especificada"}"; la fórmula debe producir esa unidad cuando sea posible.

Indicador:
- Nombre: ${input.kpi_nombre}
- Área: ${input.area_responsable ?? "no especificada"}
- Tipo: ${input.tipo_indicador ?? "no especificado"}
- Unidad: ${input.unidad_medida ?? "no especificada"}

Variables disponibles:
${variableList}

Responda en español en "reason" (1-2 frases claras).`;

  try {
    const suggestion = await generateJson<GeminiFormulaSuggestion>(prompt, responseSchema, {
      maxTokens: 512,
    });

    const knownCodes = new Set(input.variables.map((v) => v.codigo));
    const variable_codes = (suggestion.variable_codes ?? []).filter((code) =>
      knownCodes.has(code)
    );

    if (!suggestion.expresion?.trim()) {
      return NextResponse.json({
        expresion: "",
        variable_codes,
        reason: suggestion.reason || buildFallbackResponse(input).reason,
        fallback: true,
      });
    }

    return NextResponse.json({
      expresion: suggestion.expresion.trim(),
      variable_codes,
      reason: suggestion.reason,
      fallback: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar sugerencia";
    console.error("[kpis/suggest-formula] Gemini error:", message);
    return NextResponse.json(buildFallbackResponse(input));
  }
}

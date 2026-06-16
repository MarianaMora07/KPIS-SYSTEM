import { NextResponse } from "next/server";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateJson, isGeminiConfigured } from "@/lib/gemini/client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini no configurado. Añada GEMINI_API_KEY en .env.local" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const rateKey = user?.id ?? request.headers.get("x-forwarded-for") ?? "anon";
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      { error: "Límite de solicitudes IA alcanzado. Intente en 1 minuto." },
      { status: 429 }
    );
  }

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
    const plan = await generateJson<{
      titulo: string;
      descripcion: string;
      items: { descripcion: string }[];
    }>(prompt, actionPlanSchema, { maxTokens: 1024 });

    return NextResponse.json({
      titulo: String(plan.titulo).slice(0, 200),
      descripcion: String(plan.descripcion).slice(0, 2000),
      items: (plan.items ?? []).slice(0, 8).map((i) => ({
        descripcion: String(i.descripcion).slice(0, 500),
      })),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al generar sugerencia";
    console.error("[alertas/suggest-plan] Gemini error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

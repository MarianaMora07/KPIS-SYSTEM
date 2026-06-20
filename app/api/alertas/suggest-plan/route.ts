import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateJson, isGeminiConfigured } from "@/lib/gemini/client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { createClient } from "@/lib/supabase/server";
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

  if (!isGeminiConfigured()) {
    return NextResponse.json(buildFallbackPlan(kpi_nombre, hotel, semaforo));
  }

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
      fallback: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar sugerencia";
    console.error("[alertas/suggest-plan] Gemini error:", message);
    return NextResponse.json(buildFallbackPlan(kpi_nombre, hotel, semaforo));
  }
}

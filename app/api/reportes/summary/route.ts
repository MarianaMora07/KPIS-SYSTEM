import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText, isGeminiConfigured } from "@/lib/gemini/client";
import { checkRateLimit } from "@/lib/gemini/rate-limit";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ summary: null });
  }

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
    const summary = await generateText(prompt, { maxTokens: 300 });
    return NextResponse.json({ summary: summary.trim() });
  } catch (error) {
    console.error("[reportes/summary] Gemini error:", error);
    return NextResponse.json({ summary: null });
  }
}

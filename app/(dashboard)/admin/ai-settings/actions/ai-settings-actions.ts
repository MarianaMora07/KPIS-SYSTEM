"use server";

/**
 * app/(dashboard)/admin/ai-settings/actions/ai-settings-actions.ts
 *
 * Server Actions exclusivos para gestión administrativa de la IA.
 * Toda comunicación con ai_configurations usa service_role y pgp_sym_encrypt/decrypt.
 * NUNCA se expone la API Key en texto plano al cliente.
 */

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

async function createServerActionClient(_context?: { cookies: typeof cookies }) {
  return await createSupabaseServerClient();
}

// ─── Tipos públicos (sin exponer api_key) ───────────────────────────────────

export interface AiProvider {
  id: string;
  nombre: string;
  proveedor: string;
  descripcion: string | null;
  estado: "activo" | "inactivo";
}

export interface AiConfigurationRow {
  id: string;
  provider_id: string;
  provider_nombre: string;
  provider_proveedor: string;
  modelo_defecto: string;
  cuota_mensual_tokens: number;
  estado: "activo" | "inactivo";
  descripcion: string | null;
  api_key_masked: string; // p. ej. ••••••••••••a1b2
  created_at: string;
  ranking: number;
}

export interface DailyUsage {
  fecha: string;         // 'YYYY-MM-DD'
  total_tokens: number;
}

export interface ModuleUsage {
  modulo_origen: string;
  total_tokens: number;
}

export interface ProviderQuota {
  provider_id: string;
  provider_nombre: string;
  cuota_mensual_tokens: number;
  tokens_consumidos: number;
}

export interface AiUsageMetrics {
  daily: DailyUsage[];
  byModule: ModuleUsage[];
  quotas: ProviderQuota[];
}

// ─── Cliente service_role (solo server-side) ────────────────────────────────

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskApiKey(encrypted: string | null): string {
  if (!encrypted || encrypted.length < 4) return "••••••••••••••••";
  // Tomamos los últimos 4 chars del valor cifrado (opacos, no la key real)
  const last4 = encrypted.slice(-4);
  return `••••••••••••${last4}`;
}

function requireMasterSecret(): string {
  const secret = process.env.AI_MASTER_SECRET;
  if (!secret) {
    throw new Error(
      "AI_MASTER_SECRET no configurado. Agrega esta variable de entorno al servidor."
    );
  }
  return secret;
}

// ─── Action: Listar proveedores ──────────────────────────────────────────────

export async function getAiProviders(): Promise<AiProvider[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_providers")
    .select("id, nombre, proveedor:codigo, estado")
    .in("codigo", ["google_gemini", "groq", "openrouter"])
    .order("nombre");

  if (error) throw new Error(`Error listando proveedores: ${error.message}`);
  return (data ?? []).map((p: { id: string; nombre: string; proveedor: string; estado: "activo" | "inactivo" }) => ({
    id: p.id,
    nombre: p.nombre,
    proveedor: p.proveedor,
    descripcion: null,
    estado: p.estado,
  })) as AiProvider[];
}

// ─── Action: Listar configuraciones (API Key enmascarada) ────────────────────

export async function getAiConfigurations(): Promise<AiConfigurationRow[]> {
  const supabase = createServiceClient();

  // Usamos una raw query para poder leer el bytea como texto
  // y enmascararlo en el servidor antes de devolver al cliente.
  const { data, error } = await supabase.rpc("list_ai_configurations_masked");

  if (error) {
    // Fallback: si la RPC no existe todavía, hacemos la consulta manual
    const { data: rows, error: e2 } = await supabase
      .from("ai_configurations")
      .select(`
        id,
        provider_id,
        modelo_defecto,
        cuota_mensual_tokens:quota_mensual,
        estado,
        api_key_encrypted,
        created_at,
        ranking,
        descripcion,
        ai_providers ( nombre, proveedor:codigo )
      `)
      .order("ranking", { ascending: true })
      .order("created_at", { ascending: false });

    if (e2) throw new Error(`Error listando configuraciones: ${e2.message}`);

    return (rows ?? []).map((r: Record<string, unknown>) => {
      const prov = r.ai_providers as { nombre: string; proveedor: string } | null;
      const encryptedRaw = r.api_key_encrypted as string | null;
      const providerCode = prov?.proveedor ?? "";
      let defaultModel = "gemini-2.5-flash-lite";
      if (providerCode.includes("openai")) defaultModel = "gpt-4o-mini";
      else if (providerCode.includes("anthropic")) defaultModel = "claude-3-5-sonnet-latest";

      return {
        id: r.id as string,
        provider_id: r.provider_id as string,
        provider_nombre: prov?.nombre ?? "—",
        provider_proveedor: providerCode ?? "—",
        modelo_defecto: (r.modelo_defecto as string) ?? defaultModel,
        cuota_mensual_tokens: (r.cuota_mensual_tokens as number) ?? 0,
        estado: r.estado as "activo" | "inactivo",
        descripcion: (r.descripcion as string) ?? null,
        api_key_masked: maskApiKey(encryptedRaw),
        created_at: r.created_at as string,
        ranking: (r.ranking as number) ?? 1,
      };
    });
  }

  return (data ?? []) as AiConfigurationRow[];
}

// ─── Action: Guardar configuración (cifrado pgp_sym_encrypt via RPC) ─────────

export async function saveAiConfiguration(formData: {
  provider_id: string;
  modelo_defecto: string;
  cuota_mensual_tokens: number;
  api_key_plain: string;
  descripcion?: string;
  ranking?: number;
  configuration_id?: string; // si existe → actualizar
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const masterSecret = requireMasterSecret();
    const supabase = createServiceClient();
    const ranking = formData.ranking ?? 1;

    if (formData.configuration_id) {
      // UPDATE: solo actualiza la key si se proporcionó un valor no vacío
      const updatePayload: Record<string, unknown> = {
        provider_id: formData.provider_id,
        quota_mensual: formData.cuota_mensual_tokens,
        modelo_defecto: formData.modelo_defecto,
        ranking: ranking,
        descripcion: formData.descripcion ?? null,
        updated_at: new Date().toISOString(),
      };

      if (formData.api_key_plain.trim()) {
        // Ciframos via SQL para que la key nunca transite en texto plano
        const { error: encError } = await supabase.rpc(
          "upsert_ai_configuration_with_key",
          {
            p_configuration_id: formData.configuration_id,
            p_provider_id: formData.provider_id,
            p_api_key_plain: formData.api_key_plain,
            p_master_secret: masterSecret,
            p_modelo_defecto: formData.modelo_defecto,
            p_cuota_mensual_tokens: formData.cuota_mensual_tokens,
            p_descripcion: formData.descripcion ?? null,
            p_ranking: ranking,
          }
        );
        if (encError) throw new Error(encError.message);
      } else {
        const { error } = await supabase
          .from("ai_configurations")
          .update(updatePayload)
          .eq("id", formData.configuration_id);
        if (error) throw new Error(error.message);
      }
    } else {
      // INSERT: siempre ciframos vía RPC SECURITY DEFINER
      const { error } = await supabase.rpc(
        "upsert_ai_configuration_with_key",
        {
          p_configuration_id: null,
          p_provider_id: formData.provider_id,
          p_api_key_plain: formData.api_key_plain,
          p_master_secret: masterSecret,
          p_modelo_defecto: formData.modelo_defecto,
          p_cuota_mensual_tokens: formData.cuota_mensual_tokens,
          p_descripcion: formData.descripcion ?? null,
          p_ranking: ranking,
        }
      );
      if (error) throw new Error(error.message);
    }

    revalidatePath("/dashboard/admin/ai-settings");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[saveAiConfiguration]", msg);
    return { ok: false, error: msg };
  }
}

// ─── Action: Cambiar estado activo/inactivo ──────────────────────────────────

export async function toggleAiConfigurationStatus(
  configurationId: string,
  newEstado: "activo" | "inactivo"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("ai_configurations")
      .update({ estado: newEstado, updated_at: new Date().toISOString() })
      .eq("id", configurationId);

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/admin/ai-settings");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─── Action: Métricas de uso ─────────────────────────────────────────────────

export async function getAiUsageMetrics(): Promise<AiUsageMetrics> {
  const supabase = createServiceClient();

  // Últimos 30 días — consumo diario
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [dailyRes, moduleRes, configRes] = await Promise.all([
    // Consumo diario total
    supabase
      .from("ai_usage_logs")
      .select("created_at, total_tokens")
      .gte("created_at", since)
      .order("created_at"),

    // Consumo por módulo
    supabase
      .from("ai_usage_logs")
      .select("modulo_origen, total_tokens")
      .gte("created_at", since),

    // Cuotas y configuraciones activas
    supabase
      .from("ai_configurations")
      .select(`
        id,
        cuota_mensual_tokens:quota_mensual,
        ai_providers ( nombre )
      `)
      .eq("estado", "activo"),
  ]);

  // Agregar consumo diario
  const dailyMap: Record<string, number> = {};
  for (const row of dailyRes.data ?? []) {
    const fecha = (row.created_at as string).slice(0, 10);
    dailyMap[fecha] = (dailyMap[fecha] ?? 0) + (row.total_tokens as number);
  }
  const daily: DailyUsage[] = Object.entries(dailyMap)
    .map(([fecha, total_tokens]) => ({ fecha, total_tokens }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Agregar por módulo
  const moduleMap: Record<string, number> = {};
  for (const row of moduleRes.data ?? []) {
    const mod = row.modulo_origen as string;
    moduleMap[mod] = (moduleMap[mod] ?? 0) + (row.total_tokens as number);
  }
  const byModule: ModuleUsage[] = Object.entries(moduleMap)
    .map(([modulo_origen, total_tokens]) => ({ modulo_origen, total_tokens }))
    .sort((a, b) => b.total_tokens - a.total_tokens);

  // Tokens consumidos este mes por configuración
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthUsage } = await supabase
    .from("ai_usage_logs")
    .select("configuration_id, total_tokens")
    .gte("created_at", startOfMonth.toISOString());

  const consumedMap: Record<string, number> = {};
  for (const row of monthUsage ?? []) {
    const cid = row.configuration_id as string;
    consumedMap[cid] = (consumedMap[cid] ?? 0) + (row.total_tokens as number);
  }

  const quotas: ProviderQuota[] = (configRes.data ?? []).map((c: Record<string, unknown>) => {
    const prov = c.ai_providers as { nombre: string } | null;
    return {
      provider_id: c.id as string,
      provider_nombre: prov?.nombre ?? "—",
      cuota_mensual_tokens: (c.cuota_mensual_tokens as number) ?? 0,
      tokens_consumidos: consumedMap[c.id as string] ?? 0,
    };
  });

  return { daily, byModule, quotas };
}

// Extrae el catálogo de proveedores para el select del formulario
export async function getAiProvidersCatalog() {
  try {
    const supabase = await createServerActionClient({ cookies });
    
    const { data, error } = await supabase
      .from("ai_providers")
      .select("id, codigo, nombre")
      .eq("estado", "activo")
      .in("codigo", ["google_gemini", "groq", "openrouter"])
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error obteniendo catálogo de proveedores:", error);
      return [];
    }
    
    return (data ?? []) as { id: string; codigo: string; nombre: string }[];
  } catch (error) {
    console.error("Excepción obteniendo catálogo de proveedores:", error);
    return [];
  }
}

// Crea un nuevo proveedor de IA forzando el estado a 'activo'
export async function createAiProvider(data: {
  nombre: string;
  codigo: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createServerActionClient({ cookies });
    
    const { error } = await supabase
      .from("ai_providers")
      .insert({
        nombre: data.nombre,
        codigo: data.codigo,
        estado: "activo",
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/admin/ai-settings");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[createAiProvider]", msg);
    return { ok: false, error: msg };
  }
}

export interface AiModel {
  id: string;
  provider_id: string;
  codigo: string;
  nombre: string;
  estado: "activo" | "inactivo";
  created_at: string;
}

export async function getAiModelsByProvider(
  providerId: string
): Promise<AiModel[]> {
  try {
    const supabase = await createServerActionClient({ cookies });
    
    const { data, error } = await supabase
      .from("ai_models")
      .select("id, provider_id, codigo, nombre, estado, created_at")
      .eq("provider_id", providerId)
      .eq("estado", "activo")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error obteniendo modelos del proveedor:", error);
      return [];
    }
    
    return (data ?? []) as AiModel[];
  } catch (error) {
    console.error("Excepción obteniendo modelos del proveedor:", error);
    return [];
  }
}

export async function deleteAiConfiguration(
  configurationId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("ai_configurations")
      .delete()
      .eq("id", configurationId);

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/admin/ai-settings");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deleteAiConfiguration]", msg);
    return { ok: false, error: msg };
  }
}


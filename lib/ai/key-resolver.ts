/**
 * lib/ai/key-resolver.ts
 *
 * Puente TypeScript para obtener la API Key activa de un proveedor IA
 * desde la base de datos, descifrándola en el proceso vía RPC PostgreSQL.
 *
 * La función RPC `get_active_ai_api_key` usa `pgp_sym_decrypt` con el
 * secreto maestro `AI_MASTER_SECRET` (variable de entorno del servidor).
 *
 * IMPORTANTE: Usa el cliente Supabase con service_role para eludir RLS
 * (la tabla ai_configurations tiene política DENY ALL para roles normales).
 */

import { createClient } from "@supabase/supabase-js";

export type ActiveAiKey = {
  apiKey: string;
  configurationId: string;
  providerCode: string;
  modeloDefecto: string;
};

/**
 * Crea un cliente Supabase con privilegios de service_role.
 * Solo debe usarse en contextos server-side (Server Actions, Route Handlers).
 */
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Obtiene la API Key activa del proveedor indicado (o el primer proveedor activo) desde la base de datos.
 *
 * La función RPC descifra `api_key_encrypted` usando `pgp_sym_decrypt` con
 * el secreto `AI_MASTER_SECRET` inyectado como parámetro de sesión.
 *
 * @param provider - Identificador del proveedor (ej. 'google_gemini', opcional)
 * @returns { apiKey, configurationId, providerCode, modeloDefecto } del proveedor activo
 * @throws Error controlado si no hay proveedor activo, la key es nula,
 *         o faltan variables de entorno.
 */
export async function resolveActiveAiKey(
  provider?: string
): Promise<ActiveAiKey> {
  const masterSecret = process.env.AI_MASTER_SECRET;

  if (!masterSecret) {
    throw new Error(
      "AI_MASTER_SECRET no configurado. Agrega esta variable de entorno al servidor."
    );
  }

  const supabase = createServiceRoleClient();

  // Llamar al RPC de descifrado pasando el master secret directamente
  const { data, error } = await supabase.rpc("get_active_ai_api_key", {
    p_provider: provider || null,
    p_master_secret: masterSecret,
  } as any);

  if (error) {
    throw new Error(
      `Error al obtener la API Key del proveedor '${provider || "activo"}': ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      `No hay configuración activa para el proveedor '${provider || "activo"}'. ` +
        "Verifica que exista un registro en ai_configurations con estado 'activo'."
    );
  }

  const row = data[0] as {
    api_key: string;
    configuration_id: string;
    provider_code?: string;
    modelo_defecto?: string;
  };

  if (!row.api_key) {
    throw new Error(
      `La API Key descifrada para '${provider || "activo"}' es nula o vacía. ` +
        "Verifica AI_MASTER_SECRET y que la key esté correctamente cifrada en la base de datos."
    );
  }

  let providerCode = row.provider_code;
  let modeloDefecto = row.modelo_defecto;

  // Fallback si la base de datos no tiene la RPC actualizada con los nuevos campos
  if (!providerCode || !modeloDefecto) {
    const { data: configData, error: configError } = await supabase
      .from("ai_configurations")
      .select(`
        modelo_defecto,
        ai_providers ( proveedor:codigo )
      `)
      .eq("id", row.configuration_id)
      .single();

    if (!configError && configData) {
      modeloDefecto = configData.modelo_defecto;
      providerCode = (configData.ai_providers as any)?.proveedor;
    }
  }

  return {
    apiKey: row.api_key,
    configurationId: row.configuration_id,
    providerCode: providerCode || provider || "google_gemini",
    modeloDefecto: modeloDefecto || "",
  };
}

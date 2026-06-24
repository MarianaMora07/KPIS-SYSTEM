"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/permissions";
import {
  kpiCreateSchema,
  kpiValueSchema,
  type KpiCreateInput,
  type KpiValueInput,
} from "@/lib/validations/schemas";
import { formatZodError } from "@/lib/validations/format-zod-error";
import { computeKpiValueFromInputs, getRequiredInputVariableCodes } from "@/lib/kpis/compute-formula-value";
import { resolveValueDimensions } from "@/lib/kpis/dimension-scope";
import { invalidateCache } from "@/lib/cache/dashboard-cache";
import { generateNextKpiCodigo } from "../services/kpi-service";

function isValidUuid(id: any): boolean {
  if (typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function sanitizeUuid(val: any): string | null {
  if (val === "" || val === undefined || val === null) {
    return null;
  }
  if (typeof val === "string" && isValidUuid(val)) {
    return val;
  }
  return null;
}

function sanitizeDbPayload<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = { ...obj };
  const uuidKeys = [
    "id",
    "kpi_id",
    "solicitante_id",
    "aprobador_id",
    "created_by",
    "updated_by",
    "hotel_id",
    "region_id",
    "business_unit_id",
    "sales_channel_id",
    "marketing_campaign_id",
    "commercial_team_id",
    "responsable_id",
    "categoria_id",
    "kpi_value_id",
    "uploaded_by",
  ];

  for (const key of Object.keys(sanitized)) {
    const val = sanitized[key];
    if (val === undefined) {
      sanitized[key] = null as any;
    } else if (uuidKeys.includes(key)) {
      if (val === "" || val === null) {
        sanitized[key] = null as any;
      } else if (!isValidUuid(val)) {
        throw new Error(`El campo '${key}' tiene un valor inválido ("${val}"), debe ser un UUID válido o null.`);
      }
    }
  }
  return sanitized as T;
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado");
  }
  return createSupabaseClient(url, serviceRoleKey);
}

async function resolveApprovalHotelId(
  supabase: any,
  userId: string,
  proposedHotelId?: string | null,
  kpiId?: string | null
): Promise<string | null> {
  if (proposedHotelId) return proposedHotelId;
  if (kpiId) {
    const { data: kpi } = await supabase
      .from("kpis")
      .select("hotel_id")
      .eq("id", kpiId)
      .maybeSingle();
    if (kpi?.hotel_id) return kpi.hotel_id;
  }
  const { data: userScopes } = await supabase
    .from("user_hotel_scopes")
    .select("hotel_id")
    .eq("user_id", userId);
  if (userScopes && userScopes.length > 0) {
    return userScopes[0].hotel_id;
  }
  return null;
}

async function applyRegisterKpiValue(
  parsed: KpiValueInput,
  supabase: any,
  attachments?: { name: string; url: string }[],
  uploadedById?: string
) {
  if (!isValidUuid(parsed.kpi_id)) {
    throw new Error("El kpi_id proporcionado no es un UUID válido");
  }

  const { data: kpi } = await supabase
    .from("kpis")
    .select(
      "hotel_id, region_id, business_unit_id, sales_channel_id, marketing_campaign_id, commercial_team_id, formula"
    )
    .eq("id", parsed.kpi_id)
    .single();

  const rawInputs =
    parsed.variable_inputs && Object.keys(parsed.variable_inputs).length > 0
      ? parsed.variable_inputs
      : parsed.valor_real!;

  const { valorReal, variableInputs } = await computeKpiValueFromInputs(
    parsed.kpi_id,
    rawInputs
  );

  const dimensions = resolveValueDimensions(parsed, kpi ?? {});
  
  const sanitizedDimensions = {
    hotel_id: sanitizeUuid(dimensions.hotel_id),
    region_id: sanitizeUuid(dimensions.region_id),
    business_unit_id: sanitizeUuid(dimensions.business_unit_id),
    sales_channel_id: sanitizeUuid(dimensions.sales_channel_id),
    marketing_campaign_id: sanitizeUuid(dimensions.marketing_campaign_id),
    commercial_team_id: sanitizeUuid(dimensions.commercial_team_id),
  };

  const insertPayload = sanitizeDbPayload({
    kpi_id: parsed.kpi_id,
    ...sanitizedDimensions,
    fecha: parsed.fecha,
    valor_real: valorReal,
    valor_meta: null,
    fuente: "manual" as const,
    ...(variableInputs ? { variable_inputs: variableInputs } : {}),
  });

  let { data, error } = await supabase
    .from("kpi_values")
    .insert(insertPayload)
    .select()
    .single();

  if (error?.message.includes("variable_inputs")) {
    const { variable_inputs: _vi, ...fallbackPayload } = insertPayload;
    const retry = await supabase
      .from("kpi_values")
      .insert(fallbackPayload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);

  if (attachments && attachments.length > 0) {
    let finalUploadedById = uploadedById;
    if (!finalUploadedById || !isValidUuid(finalUploadedById)) {
      const userSupabase = await createClient();
      const { data: userData } = await userSupabase.auth.getUser();
      finalUploadedById = userData?.user?.id;
    }

    if (!finalUploadedById || !isValidUuid(finalUploadedById)) {
      throw new Error("No se pudo determinar un UUID de usuario válido (uploaded_by) para registrar los adjuntos");
    }

    if (!data?.id || !isValidUuid(data.id)) {
      throw new Error("El ID de la medición registrada no es un UUID válido");
    }

    const attachmentRows = attachments.map((att) => {
      if (!att.name || !att.url) {
        throw new Error("El nombre o URL del archivo adjunto no puede estar vacío");
      }
      return sanitizeDbPayload({
        kpi_value_id: data.id,
        file_name: att.name,
        file_url: att.url,
        uploaded_by: finalUploadedById!,
      });
    });

    const { error: attachError } = await supabase
      .from("kpi_value_attachments")
      .insert(attachmentRows);

    if (attachError) {
      throw new Error("Error al guardar archivos de soporte: " + attachError.message);
    }
  }

  const { notifyAlertForKpiValue } = await import(
    "@/modules/alertas/services/alert-service"
  );
  await notifyAlertForKpiValue(data.id).catch(() => {});

  return data;
}

export async function createKpiAction(input: KpiCreateInput) {
  await assertPermission("kpis.crear");
  const codigo = input.codigo?.trim() ? input.codigo.trim() : await generateNextKpiCodigo();
  let parsed: KpiCreateInput;
  try {
    parsed = kpiCreateSchema.parse({ ...input, codigo });
  } catch (e) {
    throw new Error(formatZodError(e));
  }
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { rol } = await getUserPermissions();
  const isApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(rol || "");
  const isCreator = ["gerente_hotel", "analista"].includes(rol || "");

  if (isApprover) {
    const { estado: _e, ...rest } = parsed;

    const { data, error } = await supabase
      .from("kpis")
      .insert({ ...rest, estado: "activo", created_by: user.id, updated_by: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/kpis");
    revalidatePath("/dashboard");
    return data;
  } else if (isCreator) {
    const hotelId = await resolveApprovalHotelId(supabase, user.id, parsed.hotel_id);
    if (!hotelId || !isValidUuid(hotelId)) {
      throw new Error("No se pudo determinar un UUID de hotel de origen válido");
    }

    const adminClient = createAdminClient();
    const payload = sanitizeDbPayload({
      solicitante_id: user.id,
      hotel_id: hotelId,
      tipo: "creacion",
      estado: "pendiente",
      datos_propuestos: parsed,
    });
    const { data, error } = await adminClient
      .from("kpi_approval_requests")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { approvalRequired: true, request: data };
  } else {
    throw new Error("No tiene permisos para esta acción");
  }
}

export async function inactivateKpiAction(id: string) {
  await assertPermission("kpis.inactivar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("kpis")
    .update({ estado: "inactivo", updated_by: user.id })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/kpis");
  revalidatePath("/dashboard");
}

export async function updateKpiAction(id: string, input: KpiCreateInput) {
  await assertPermission("kpis.editar");
  let parsed: KpiCreateInput;
  try {
    parsed = kpiCreateSchema.parse(input);
  } catch (e) {
    throw new Error(formatZodError(e));
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { rol } = await getUserPermissions();
  const isApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(rol || "");
  const isCreator = ["gerente_hotel", "analista"].includes(rol || "");

  if (isApprover) {
    const { updateKpi } = await import("../services/kpi-service");
    await updateKpi(id, parsed, user.id);
    revalidatePath("/kpis");
    revalidatePath(`/kpis/${id}`);
    revalidatePath("/dashboard");
  } else if (isCreator) {
    const hotelId = await resolveApprovalHotelId(supabase, user.id, parsed.hotel_id, id);
    if (!hotelId || !isValidUuid(hotelId)) {
      throw new Error("No se pudo determinar un UUID de hotel de origen válido");
    }
    if (!isValidUuid(id)) {
      throw new Error("ID de KPI inválido (no es un UUID)");
    }

    const adminClient = createAdminClient();
    const payload = sanitizeDbPayload({
      kpi_id: id,
      solicitante_id: user.id,
      hotel_id: hotelId,
      tipo: "edicion",
      estado: "pendiente",
      datos_propuestos: parsed,
    });
    const { data, error } = await adminClient
      .from("kpi_approval_requests")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { approvalRequired: true, request: data };
  } else {
    throw new Error("No tiene permisos para esta acción");
  }
}

export async function duplicateKpiAction(id: string) {
  await assertPermission("kpis.crear");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { duplicateKpi } = await import("../services/kpi-service");
  const copy = await duplicateKpi(id, user.id);
  revalidatePath("/kpis");
  return copy;
}

export async function registerKpiValueAction(
  input: KpiValueInput,
  attachments?: { name: string; url: string }[]
) {
  await assertPermission("metas.configurar");
  const parsed = kpiValueSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { rol } = await getUserPermissions();
  const isApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(rol || "");
  const isCreator = ["gerente_hotel", "analista"].includes(rol || "");

  if (isApprover) {
    const data = await applyRegisterKpiValue(parsed, supabase, attachments, user.id);
    invalidateCache("dashboard");
    invalidateCache("cards");
    revalidatePath("/dashboard");
    revalidatePath("/kpis");
    revalidatePath(`/kpis/${parsed.kpi_id}`);
    return data;
  } else if (isCreator) {
    const hotelId = await resolveApprovalHotelId(supabase, user.id, parsed.hotel_id, parsed.kpi_id);
    if (!hotelId || !isValidUuid(hotelId)) {
      throw new Error("No se pudo determinar un UUID de hotel de origen válido");
    }
    if (!isValidUuid(parsed.kpi_id)) {
      throw new Error("ID de KPI inválido (no es un UUID)");
    }

    const adminClient = createAdminClient();
    const payload = sanitizeDbPayload({
      kpi_id: parsed.kpi_id,
      solicitante_id: user.id,
      hotel_id: hotelId,
      tipo: "medicion",
      estado: "pendiente",
      datos_propuestos: {
        ...parsed,
        attachments,
      },
    });
    const { data, error } = await adminClient
      .from("kpi_approval_requests")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { approvalRequired: true, request: data };
  } else {
    throw new Error("No tiene permisos para esta acción");
  }
}

export async function deleteKpiValueAction(kpiId: string, valueId: string) {
  const { rol } = await assertPermission("metas.configurar");
  if (rol !== "administrador") {
    throw new Error("Solo un administrador puede eliminar valores registrados");
  }
  const { deleteKpiValue } = await import("../services/kpi-service");
  await deleteKpiValue(kpiId, valueId);
  invalidateCache("dashboard");
  invalidateCache("cards");
  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  revalidatePath(`/kpis/${kpiId}`);
}

export async function getKpiFormulaVariableCodesAction(kpiId: string) {
  await assertPermission("metas.configurar");
  return getRequiredInputVariableCodes(kpiId);
}

export async function updateKpiReviewNotificationsAction(
  kpiId: string,
  input: { recordatorio_email_activo: boolean; recordatorio_emails: string[] }
) {
  await assertPermission("metas.configurar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("kpis")
    .update({
      recordatorio_email_activo: input.recordatorio_email_activo,
      recordatorio_emails: input.recordatorio_emails,
      updated_by: user.id,
    })
    .eq("id", kpiId);

  if (error) throw new Error(error.message);

  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath(`/kpis/${kpiId}/editar`);
}

export async function processApprovalRequest(
  requestId: string,
  action: "aprobar" | "rechazar",
  obs?: string
) {
  if (!isValidUuid(requestId)) {
    throw new Error("ID de solicitud inválido (no es un UUID)");
  }

  const { rol } = await assertPermission("kpis.editar");
  const isApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(rol || "");
  if (!isApprover) {
    throw new Error("Solo los Directores o Administradores pueden procesar solicitudes de aprobación");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  if (!isValidUuid(user.id)) {
    throw new Error("ID de usuario del aprobador no es un UUID válido");
  }

  const adminClient = createAdminClient();
  const { data: request, error: fetchError } = await adminClient
    .from("kpi_approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    throw new Error(fetchError?.message || "Solicitud no encontrada");
  }

  if (request.estado !== "pendiente") {
    throw new Error("Esta solicitud ya ha sido procesada");
  }

  let targetKpiId: string | null = request.kpi_id || null;

  if (action === "rechazar") {
    const payload = sanitizeDbPayload({
      estado: "rechazado",
      observaciones: obs || null,
      aprobador_id: user.id,
      updated_at: new Date().toISOString(),
    });
    const { error: updateError } = await adminClient
      .from("kpi_approval_requests")
      .update(payload)
      .eq("id", requestId);

    if (updateError) throw new Error(updateError.message);
  } else if (action === "aprobar") {
    const datos = sanitizeDbPayload(request.datos_propuestos);

    if (request.tipo === "creacion") {
      const { formula, estado: _e, ...rest } = datos;
      if (!isValidUuid(request.solicitante_id)) {
        throw new Error("solicitante_id de la solicitud no es un UUID válido");
      }
      const newKpiPayload = sanitizeDbPayload({
        ...rest,
        estado: "activo",
        created_by: request.solicitante_id,
        updated_by: user.id,
      });
      const { data: newKpi, error: insertError } = await adminClient
        .from("kpis")
        .insert(newKpiPayload)
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      targetKpiId = newKpi.id;

      if (formula) {
        const { saveKpiFormula } = await import("@/modules/formulas/services/formula-service");
        await saveKpiFormula(newKpi.id, formula, user.id);
      }
    } else if (request.tipo === "edicion") {
      if (!targetKpiId || !isValidUuid(targetKpiId)) {
        throw new Error("ID de KPI no especificado o inválido para la edición");
      }
      if (!isValidUuid(request.solicitante_id)) {
        throw new Error("solicitante_id de la solicitud no es un UUID válido");
      }

      const { updateKpi } = await import("../services/kpi-service");
      await updateKpi(targetKpiId, datos, request.solicitante_id);
    } else if (request.tipo === "medicion") {
      const { attachments, ...restDatos } = datos;
      if (!isValidUuid(request.solicitante_id)) {
        throw new Error("solicitante_id de la solicitud no es un UUID válido");
      }
      await applyRegisterKpiValue(restDatos, adminClient, attachments, request.solicitante_id);
    }

    const approvalPayload = sanitizeDbPayload({
      estado: "aprobado",
      kpi_id: targetKpiId,
      aprobador_id: user.id,
      updated_at: new Date().toISOString(),
    });
    const { error: updateError } = await adminClient
      .from("kpi_approval_requests")
      .update(approvalPayload)
      .eq("id", requestId);

    if (updateError) throw new Error(updateError.message);
  }

  invalidateCache("dashboard");
  invalidateCache("cards");
  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  if (request.kpi_id) {
    revalidatePath(`/kpis/${request.kpi_id}`);
  }
  if (targetKpiId) {
    revalidatePath(`/kpis/${targetKpiId}`);
  }
  revalidatePath("/admin/aprobaciones");
}

import { createClient } from "@/lib/supabase/server";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";
import { getAdapterFor } from "../adapters/pms-demo-adapter";
import type { IntegrationRecord } from "../adapters/types";
import { computeKpiValueFromInputs } from "@/lib/kpis/compute-formula-value";

export async function processIntegrationSync(
  integrationId: string,
  jobId: string
): Promise<{ ok: boolean; registrosOk: number; registrosError: number; error?: string }> {
  const supabase = await createClient();

  const { data: integration, error: intError } = await supabase
    .from("external_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (intError || !integration) {
    return { ok: false, registrosOk: 0, registrosError: 0, error: "Integración no encontrada" };
  }

  const adapter = getAdapterFor(integration.sistema_tipo);
  const maxRetries = integration.max_reintentos ?? 3;
  let attempt = 0;
  let lastError: string | undefined;

  while (attempt < maxRetries) {
    attempt++;
    await supabase
      .from("integration_jobs")
      .update({ estado: "reintentando", intento: attempt, started_at: new Date().toISOString() })
      .eq("id", jobId);

    try {
      const records = await adapter.fetchRecords(integration as IntegrationRecord);
      let ok = 0;
      let err = 0;

      for (const rec of records) {
        const { data: kpi } = await supabase
          .from("kpis")
          .select("id, hotel_id, region_id, meta")
          .eq("codigo", rec.kpi_codigo)
          .eq("estado", "activo")
          .maybeSingle();

        if (!kpi) {
          err++;
          await supabase.from("integration_logs").insert({
            integration_job_id: jobId,
            nivel: "warn",
            mensaje: `KPI no encontrado: ${rec.kpi_codigo}`,
          });
          continue;
        }

        const rawInputs =
          rec.variables && Object.keys(rec.variables).length > 0
            ? rec.variables
            : rec.valor;

        let valorReal: number;
        let variableInputs: Record<string, number> | null = null;
        try {
          const computed = await computeKpiValueFromInputs(kpi.id, rawInputs);
          valorReal = computed.valorReal;
          variableInputs = computed.variableInputs;
        } catch {
          err++;
          await supabase.from("integration_logs").insert({
            integration_job_id: jobId,
            nivel: "error",
            mensaje: `Error al calcular fórmula para ${rec.kpi_codigo}`,
            payload: rec,
          });
          continue;
        }

        const { error: upsertError } = await supabase.from("kpi_values").upsert(
          {
            kpi_id: kpi.id,
            hotel_id: kpi.hotel_id,
            region_id: kpi.region_id,
            fecha: rec.fecha,
            valor_real: valorReal,
            valor_meta: kpi.meta,
            variable_inputs: variableInputs,
            fuente: "integracion",
          },
          { onConflict: "kpi_id,hotel_id,fecha" }
        );

        if (upsertError) {
          err++;
          await supabase.from("integration_logs").insert({
            integration_job_id: jobId,
            nivel: "error",
            mensaje: upsertError.message,
            payload: rec,
          });
        } else {
          ok++;
        }
      }

      await supabase
        .from("integration_jobs")
        .update({
          estado: err > 0 && ok === 0 ? "fallido" : err > 0 ? "parcial" : "completado",
          registros_ok: ok,
          registros_error: err,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      await supabase.from("integration_logs").insert({
        integration_job_id: jobId,
        nivel: "info",
        mensaje: `Sync completado: ${ok} ok, ${err} errores`,
      });

      return { ok: ok > 0, registrosOk: ok, registrosError: err };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Error de sync";
      await supabase.from("integration_logs").insert({
        integration_job_id: jobId,
        nivel: "error",
        mensaje: `Intento ${attempt}: ${lastError}`,
      });
    }
  }

  await supabase
    .from("integration_jobs")
    .update({
      estado: "fallido",
      intento: maxRetries,
      error_mensaje: lastError,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await dispatchActivepiecesEvent("integration.failed", {
    jobId,
    integrationId,
    integrationNombre: integration.nombre,
    error: lastError,
  });

  return { ok: false, registrosOk: 0, registrosError: 0, error: lastError };
}

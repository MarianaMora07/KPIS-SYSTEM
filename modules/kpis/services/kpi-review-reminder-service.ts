import { createClient } from "@/lib/supabase/server";
import { dispatchActivepiecesEvent } from "@/lib/activepieces/dispatch";
import { buildReviewReminderMessage, isReviewDue } from "@/lib/kpis/review-schedule";
import type { KpiFrequency } from "@/types/database";

export interface KpiReviewReminderRow {
  id: string;
  codigo: string;
  nombre: string;
  frecuencia: KpiFrequency;
  created_at: string;
  recordatorio_emails: string[];
  ultimo_recordatorio_at: string | null;
  responsable_id: string | null;
  responsable_email: string | null;
  responsable_nombre: string | null;
  last_value_date: string | null;
}

function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

export async function listKpisDueForReviewReminder(): Promise<KpiReviewReminderRow[]> {
  const supabase = await createClient();

  const { data: kpis, error } = await supabase
    .from("kpis")
    .select(
      "id, codigo, nombre, frecuencia, created_at, recordatorio_emails, ultimo_recordatorio_at, responsable_id"
    )
    .eq("estado", "activo")
    .eq("recordatorio_email_activo", true);

  if (error) throw new Error(error.message);
  if (!kpis?.length) return [];

  const kpiIds = kpis.map((k) => k.id as string);
  const responsableIds = [
    ...new Set(kpis.map((k) => k.responsable_id as string | null).filter(Boolean)),
  ] as string[];

  const [{ data: values, error: valuesError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase
        .from("kpi_values")
        .select("kpi_id, fecha")
        .in("kpi_id", kpiIds)
        .order("fecha", { ascending: false }),
      responsableIds.length > 0
        ? supabase
            .from("user_profiles")
            .select("id, email, nombre, apellido")
            .in("id", responsableIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (valuesError) throw new Error(valuesError.message);
  if (profilesError) throw new Error(profilesError.message);

  const lastValueByKpi = new Map<string, string>();
  for (const value of values ?? []) {
    const kpiId = value.kpi_id as string;
    if (!lastValueByKpi.has(kpiId)) {
      lastValueByKpi.set(kpiId, value.fecha as string);
    }
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        email: p.email as string,
        nombre: [p.nombre, p.apellido].filter(Boolean).join(" "),
      },
    ])
  );

  const due: KpiReviewReminderRow[] = [];

  for (const kpi of kpis) {
    const frecuencia = kpi.frecuencia as KpiFrequency;
    const lastValueDate = lastValueByKpi.get(kpi.id as string) ?? null;
    const responsableId = kpi.responsable_id as string | null;
    const responsable = responsableId ? profileById.get(responsableId) : undefined;

    if (
      !isReviewDue({
        frecuencia,
        createdAt: kpi.created_at as string,
        lastValueDate,
        ultimoRecordatorioAt: (kpi.ultimo_recordatorio_at as string | null) ?? null,
      })
    ) {
      continue;
    }

    due.push({
      id: kpi.id as string,
      codigo: kpi.codigo as string,
      nombre: kpi.nombre as string,
      frecuencia,
      created_at: kpi.created_at as string,
      recordatorio_emails: (kpi.recordatorio_emails as string[]) ?? [],
      ultimo_recordatorio_at: (kpi.ultimo_recordatorio_at as string | null) ?? null,
      responsable_id: responsableId,
      responsable_email: responsable?.email ?? null,
      responsable_nombre: responsable?.nombre ?? null,
      last_value_date: lastValueDate,
    });
  }

  return due;
}

export async function dispatchKpiReviewReminders(): Promise<{
  processed: number;
  kpiIds: string[];
}> {
  const due = await listKpisDueForReviewReminder();
  if (due.length === 0) return { processed: 0, kpiIds: [] };

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const sentIds: string[] = [];

  for (const kpi of due) {
    const emails = uniqueEmails([
      ...(kpi.responsable_email ? [kpi.responsable_email] : []),
      ...kpi.recordatorio_emails,
    ]);

    if (emails.length === 0) continue;

    const mensaje = buildReviewReminderMessage({
      codigo: kpi.codigo,
      nombre: kpi.nombre,
      frecuencia: kpi.frecuencia,
      lastValueDate: kpi.last_value_date,
    });

    await dispatchActivepiecesEvent("kpi.review.due", {
      kpiId: kpi.id,
      kpiCodigo: kpi.codigo,
      kpiNombre: kpi.nombre,
      frecuencia: kpi.frecuencia,
      emails,
      responsableEmail: kpi.responsable_email,
      responsableNombre: kpi.responsable_nombre,
      lastValueDate: kpi.last_value_date,
      mensaje,
      kpiUrl: appUrl
        ? `${appUrl}/kpis/${kpi.id}?tab=seguimiento`
        : `/kpis/${kpi.id}?tab=seguimiento`,
    });

    const { error } = await supabase
      .from("kpis")
      .update({ ultimo_recordatorio_at: new Date().toISOString() })
      .eq("id", kpi.id);

    if (!error) sentIds.push(kpi.id);
  }

  return { processed: sentIds.length, kpiIds: sentIds };
}

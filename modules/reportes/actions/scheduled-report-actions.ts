"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
} from "../services/scheduled-reports-service";

export async function createScheduledReportAction(input: {
  nombre: string;
  frecuencia_cron: string;
  formato: string;
  emails: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const emails = input.emails
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (emails.length === 0) throw new Error("Indique al menos un correo");

  await createScheduledReport(user.id, {
    nombre: input.nombre,
    frecuencia_cron: input.frecuencia_cron,
    formato: input.formato,
    emails,
  });

  revalidatePath("/reportes");
}

export async function toggleScheduledReportAction(id: string, activo: boolean) {
  await toggleScheduledReport(id, activo);
  revalidatePath("/reportes");
}

export async function deleteScheduledReportAction(id: string) {
  await deleteScheduledReport(id);
  revalidatePath("/reportes");
}

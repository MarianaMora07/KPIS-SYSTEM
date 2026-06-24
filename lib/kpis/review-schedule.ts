import type { KpiFrequency } from "@/types/database";
import { formatFrequencyLabel } from "@/lib/kpis/suggest-frequency";

const PERIOD_DAYS: Record<KpiFrequency, number> = {
  diaria: 1,
  semanal: 7,
  mensual: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

export function getReviewPeriodDays(frecuencia: KpiFrequency): number {
  return PERIOD_DAYS[frecuencia];
}

export function isReviewDue(input: {
  frecuencia: KpiFrequency;
  createdAt: string;
  lastValueDate: string | null;
  ultimoRecordatorioAt: string | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const periodMs = getReviewPeriodDays(input.frecuencia) * 86_400_000;

  const anchor = input.lastValueDate
    ? new Date(input.lastValueDate)
    : new Date(input.createdAt);

  const msSinceValue = now.getTime() - anchor.getTime();
  if (msSinceValue < periodMs) return false;

  if (input.ultimoRecordatorioAt) {
    const msSinceReminder = now.getTime() - new Date(input.ultimoRecordatorioAt).getTime();
    if (msSinceReminder < periodMs) return false;
  }

  return true;
}

export function buildReviewReminderMessage(input: {
  codigo: string;
  nombre: string;
  frecuencia: KpiFrequency;
  lastValueDate: string | null;
}): string {
  const freqLabel = formatFrequencyLabel(input.frecuencia).toLowerCase();
  if (!input.lastValueDate) {
    return `Es momento de registrar el primer valor del KPI ${input.codigo} (${input.nombre}). Frecuencia ${freqLabel}.`;
  }
  return `Revise y registre el valor del KPI ${input.codigo} (${input.nombre}). No hay mediciones recientes según la frecuencia ${freqLabel}.`;
}

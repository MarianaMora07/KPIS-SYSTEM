/** Fecha de hoy en calendario local (YYYY-MM-DD). */
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Meta vencida si la fecha fin ya pasó (comparación por día). */
export function isTargetExpired(fechaFin: string, today = todayDateString()): boolean {
  return fechaFin < today;
}

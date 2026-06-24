const ACTION_STYLES: Record<string, string> = {
  crear: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700",
  actualizar: "bg-amber-500/10 border-amber-500/25 text-amber-700",
  eliminar: "bg-red-500/10 border-red-500/25 text-red-700",
};

const ACTION_LABELS: Record<string, string> = {
  crear: "CREAR",
  actualizar: "ACTUALIZAR",
  eliminar: "ELIMINAR",
  inactivar: "INACTIVAR",
  duplicar: "DUPLICAR",
  importar: "IMPORTAR",
  integrar: "INTEGRAR",
  calcular: "CALCULAR",
  exportar: "EXPORTAR",
};

export function AuditActionBadge({ action }: { action: string }) {
  const key = action?.toLowerCase() ?? "";
  const cls =
    ACTION_STYLES[key] ??
    "bg-slate-100 border-slate-300/50 text-slate-700";

  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${cls}`}
    >
      {ACTION_LABELS[key] ?? action?.toUpperCase() ?? "—"}
    </span>
  );
}

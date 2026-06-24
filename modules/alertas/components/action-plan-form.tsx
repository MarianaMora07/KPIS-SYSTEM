"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createActionPlanAction } from "@/modules/alertas/actions/alert-actions";
import { FormField, FormActions } from "@/components/ui/form-modal";
import type { AlertSeverity } from "../types";

interface UserOption {
  id: string;
  nombre: string;
}

interface ActionPlanFormProps {
  kpiId: string;
  kpiNombre: string;
  hotelNombre?: string;
  alertId?: string;
  severidad?: AlertSeverity;
  defaultTitulo?: string;
  users?: UserOption[];
  valorReal?: number | null;
  valorMeta?: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface SuggestedPlan {
  titulo: string;
  descripcion: string;
  items: { descripcion: string }[];
  fallback?: boolean;
}

export function ActionPlanForm({
  kpiId,
  kpiNombre,
  hotelNombre,
  alertId,
  severidad = "riesgo",
  defaultTitulo,
  users = [],
  valorReal,
  valorMeta,
  onSuccess,
  onCancel,
}: ActionPlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  // Auto-dismiss AI error toast after 5s
  useEffect(() => {
    if (!aiError) return;
    const t = setTimeout(() => setAiError(null), 5000);
    return () => clearTimeout(t);
  }, [aiError]);
  const [titulo, setTitulo] = useState(
    defaultTitulo ?? `Plan de mejora — ${kpiNombre}${hotelNombre ? ` (${hotelNombre})` : ""}`
  );
  const [descripcion, setDescripcion] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState(() =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [responsableId, setResponsableId] = useState(users[0]?.id ?? "");
  const [items, setItems] = useState("");

  async function handleSuggest() {
    setSuggesting(true);
    setAiError(null);
    setSuggestNote(null);
    try {
      const res = await fetch("/api/alertas/suggest-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi_nombre: kpiNombre,
          hotel: hotelNombre,
          valor_real: valorReal ?? undefined,
          valor_meta: valorMeta ?? undefined,
          semaforo: severidad === "critico" ? "incumplimiento" : "riesgo",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as SuggestedPlan & {
        error?: string;
      };
      if (!res.ok && data.error) {
        throw new Error(data.error);
      }
      const titulo = data.titulo ?? `Plan correctivo — ${kpiNombre}`;
      const descripcion = data.descripcion ?? "";
      const itemLines = (data.items ?? []).map((i) => i.descripcion).filter(Boolean);
      setTitulo(titulo);
      setDescripcion(descripcion);
      setItems(
        itemLines.length > 0
          ? itemLines.join("\n")
          : [
              `Revisar desempeño de ${kpiNombre}`,
              "Definir acciones correctivas con responsable",
              "Monitorear avance semanal",
            ].join("\n")
      );
      if (data.fallback || !res.ok) {
        setSuggestNote(
          res.ok
            ? "Plantilla local aplicada (Servicio de IA no disponible). Puede editar el texto antes de guardar."
            : "Sugerencia local aplicada. El servicio de IA no respondió; puede editar antes de guardar."
        );
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error al contactar el servicio de IA. Puede escribir su plan manualmente.");
    } finally {
      setSuggesting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const itemLines = items
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        await createActionPlanAction({
          kpi_id: kpiId,
          alert_id: alertId ?? null,
          titulo,
          descripcion: descripcion || null,
          fecha_compromiso: fechaCompromiso,
          responsable_id: responsableId || null,
          items: itemLines.map((descripcion) => ({ descripcion })),
        });
        if (onSuccess) onSuccess();
        else {
          router.push("/alertas");
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleCancel() {
    if (onCancel) onCancel();
    else router.push("/alertas");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* AI Error Toast */}
      <AnimatePresence>
        {aiError && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>{aiError} Puede escribir el plan manualmente.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {suggestNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {suggestNote}
        </p>
      )}

      <FormField label="Título del plan" required>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </FormField>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Descripción del Plan</label>
          <button
            type="button"
            id="btn-generar-sugerencia-ia"
            onClick={handleSuggest}
            disabled={suggesting}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition-all hover:border-amber-400 hover:from-amber-100 hover:to-yellow-100 hover:shadow-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {suggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            )}
            {suggesting ? "Generando…" : "Generar Sugerencia IA"}
          </button>
        </div>
        <textarea
          id="descripcion-plan"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          placeholder="Describa las acciones para revertir el incumplimiento… o presione 'Generar Sugerencia IA'"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      <FormField label="Ítems del plan (uno por línea)">
        <textarea
          value={items}
          onChange={(e) => setItems(e.target.value)}
          rows={4}
          placeholder="Revisar campaña digital&#10;Capacitar equipo de ventas&#10;..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </FormField>

      <FormField label="Responsable" required>
        {users.length > 0 ? (
          <select
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500">Se asignará al usuario actual.</p>
        )}
      </FormField>

      <FormField label="Fecha compromiso" required>
        <input
          type="date"
          value={fechaCompromiso}
          onChange={(e) => setFechaCompromiso(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </FormField>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <FormActions
        onCancel={handleCancel}
        submitLabel="Guardar plan"
        pending={pending}
        pendingLabel="Guardando…"
      />
    </form>
  );
}

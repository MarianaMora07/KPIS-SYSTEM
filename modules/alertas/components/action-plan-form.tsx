"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
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
  onSuccess,
  onCancel,
}: ActionPlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(
    defaultTitulo ?? `Plan de mejora — ${kpiNombre}${hotelNombre ? ` (${hotelNombre})` : ""}`
  );
  const [descripcion, setDescripcion] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [responsableId, setResponsableId] = useState(users[0]?.id ?? "");
  const [items, setItems] = useState("");

  async function handleSuggest() {
    setSuggesting(true);
    setError(null);
    setSuggestNote(null);
    try {
      const res = await fetch("/api/alertas/suggest-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi_nombre: kpiNombre,
          hotel: hotelNombre,
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
            ? "Plantilla local aplicada (Gemini no disponible). Puede editar el texto antes de guardar."
            : "Sugerencia local aplicada. Gemini no respondió; puede editar antes de guardar."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al sugerir plan");
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
        >
          {suggesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Sugerir con IA
        </button>
      </div>

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

      <FormField label="Acciones correctivas">
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Describa las acciones para revertir el incumplimiento…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </FormField>

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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { createActionPlanAction } from "@/modules/alertas/actions/alert-actions";
import { FormField, FormActions } from "@/components/ui/form-modal";

interface ActionPlanFormProps {
  kpiId: string;
  kpiNombre: string;
  hotelNombre?: string;
  alertId?: string;
  defaultTitulo?: string;
}

interface SuggestedPlan {
  titulo: string;
  descripcion: string;
  items: { descripcion: string }[];
}

export function ActionPlanForm({
  kpiId,
  kpiNombre,
  hotelNombre,
  alertId,
  defaultTitulo,
}: ActionPlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(
    defaultTitulo ?? `Plan de mejora — ${kpiNombre}${hotelNombre ? ` (${hotelNombre})` : ""}`
  );
  const [descripcion, setDescripcion] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [items, setItems] = useState("");

  async function handleSuggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/alertas/suggest-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi_nombre: kpiNombre,
          hotel: hotelNombre,
          semaforo: "incumplimiento",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo generar sugerencia");
      }
      const data: SuggestedPlan = await res.json();
      setTitulo(data.titulo);
      setDescripcion(data.descripcion);
      setItems(data.items.map((i) => i.descripcion).join("\n"));
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
          items: itemLines.map((descripcion) => ({ descripcion })),
        });
        router.push("/alertas");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
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
        onCancel={() => router.push("/alertas")}
        submitLabel="Guardar plan"
        pending={pending}
        pendingLabel="Guardando…"
      />
    </form>
  );
}

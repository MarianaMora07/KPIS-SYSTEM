"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";

export interface ImportHistoryItem {
  id: string;
  nombre_archivo: string;
  estado: string;
  total_filas: number | null;
  filas_ok: number | null;
  created_at: string;
}

export function ImportHistoryList({ jobs }: { jobs: ImportHistoryItem[] }) {
  const router = useRouter();
  const { showSuccess } = useSuccessToast();
  const [jobToDelete, setJobToDelete] = useState<ImportHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!jobToDelete) return;

    setDeletingId(jobToDelete.id);
    setError(null);

    try {
      const res = await fetch(`/api/import/${jobToDelete.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo eliminar");
      }

      setJobToDelete(null);
      showSuccess(SUCCESS_MESSAGES.deleted);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  if (jobs.length === 0) return null;

  return (
    <>
      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          Historial de importaciones
        </h2>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <ul className="space-y-2 text-sm">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="grid gap-2 rounded bg-slate-50 px-3 py-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
            >
              <span className="truncate font-medium text-imperial-900">
                {job.nombre_archivo}
              </span>
              <span className="text-slate-500">
                {job.estado} · {job.filas_ok ?? 0}/{job.total_filas ?? 0} ok
              </span>
              <span className="text-xs text-slate-400 sm:text-right">
                {new Date(job.created_at).toLocaleString("es-CO")}
              </span>
              <button
                type="button"
                onClick={() => setJobToDelete(job)}
                disabled={deletingId === job.id}
                className="inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Eliminar del historial"
              >
                {deletingId === job.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={!!jobToDelete}
        title="Eliminar importación"
        description={
          jobToDelete
            ? `¿Desea eliminar «${jobToDelete.nombre_archivo}» del historial? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={!!deletingId}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deletingId && setJobToDelete(null)}
      />
    </>
  );
}

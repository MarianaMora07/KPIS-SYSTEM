"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GUIDED_SUCCESS, SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import {
  FormModal,
  FormField,
  FormActions,
  FormError,
  FormPrimaryButton,
} from "@/components/ui/form-modal";
import { FormUnitSelect } from "@/components/ui/form-unit-select";
import {
  createVariableAction,
  deleteVariableAction,
  getVariableUsageAction,
} from "../actions/variable-actions";

interface VariableUsage {
  kpis: { id: string; codigo: string; nombre: string }[];
  compositeVariables: { id: string; codigo: string; nombre: string }[];
}

interface VariableRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  unidad_medida?: string | null;
  formula_compuesta?: string | null;
}

export function VariablesCatalogView({ variables }: { variables: VariableRow[] }) {
  const { canManageUsers } = usePermissions();
  const { showGuidedSuccess, showSuccess } = useSuccessToast();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [tipo, setTipo] = useState<"simple" | "compuesta">("simple");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<VariableRow | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<VariableUsage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function closeCreateModal() {
    setCreateOpen(false);
    setTipo("simple");
    setError(null);
  }

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const selectedTipo = fd.get("tipo") as "simple" | "compuesta";
    startTransition(async () => {
      try {
        await createVariableAction({
          codigo: fd.get("codigo") as string,
          nombre: fd.get("nombre") as string,
          tipo: selectedTipo,
          unidad_medida: (fd.get("unidad_medida") as string) || undefined,
          formula_compuesta:
            selectedTipo === "compuesta"
              ? (fd.get("formula_compuesta") as string)
              : undefined,
        });
        closeCreateModal();
        showGuidedSuccess(GUIDED_SUCCESS.variableCreated);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function openDeleteDialog(variable: VariableRow) {
    setDeleteError(null);
    setToDelete(variable);
    setDeleteUsage(null);
    setDeleteLoading(true);
    try {
      const usage = await getVariableUsageAction(variable.id);
      setDeleteUsage(usage);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al verificar uso");
    } finally {
      setDeleteLoading(false);
    }
  }

  function closeDeleteDialog() {
    setToDelete(null);
    setDeleteUsage(null);
    setDeleteError(null);
  }

  function handleConfirmDelete() {
    if (!toDelete) return;
    startTransition(async () => {
      try {
        await deleteVariableAction(toDelete.id);
        closeDeleteDialog();
        showSuccess(SUCCESS_MESSAGES.deleted);
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  const affectedKpis = deleteUsage?.kpis ?? [];

  return (
    <>
      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
              Variables de fórmula
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {variables.length} variable{variables.length !== 1 ? "s" : ""} activa
              {variables.length !== 1 ? "s" : ""} en el catálogo global
            </p>
          </div>
          {canManageUsers && (
            <FormPrimaryButton onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva variable
            </FormPrimaryButton>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
          <p className="font-medium">Simple vs compuesta</p>
          <p className="mt-1 text-amber-800">
            Las variables <strong>simples</strong> son valores que se ingresan al registrar un KPI.
            Las <strong>compuestas</strong> encapsulan sub-cálculos reutilizables (solo referencian
            simples). Use compuestas para flexibilidad sin duplicar indicadores ni crear fórmulas
            distintas por hotel o canal.
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          {variables.map((v) => (
            <li key={v.id} className="rounded-lg border border-slate-100 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-imperial-900">{v.codigo}</p>
                  <p className="text-slate-600">{v.nombre}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{v.tipo}</span>
                    {v.unidad_medida && <p className="mt-1">{v.unidad_medida}</p>}
                  </div>
                  {canManageUsers && (
                    <button
                      type="button"
                      onClick={() => openDeleteDialog(v)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Eliminar variable"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {v.tipo === "compuesta" && v.formula_compuesta && (
                <p className="mt-2 font-mono text-xs text-slate-500">{v.formula_compuesta}</p>
              )}
            </li>
          ))}
          {variables.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-slate-500">
              No hay variables en el catálogo.
              {canManageUsers && " Cree la primera con el botón superior."}
            </li>
          )}
        </ul>
      </section>

      <FormModal
        open={createOpen}
        onClose={closeCreateModal}
        title="Nueva variable"
        subtitle="Defina una variable reutilizable en las fórmulas de los indicadores"
        maxWidth="md"
      >
        <form className="space-y-4" onSubmit={handleCreateSubmit}>
          <FormField
            label="Código"
            name="codigo"
            required
            placeholder="codigo_variable"
          />
          <FormField label="Nombre" name="nombre" required placeholder="Nombre descriptivo" />
          <div>
            <label className="form-label">Tipo</label>
            <select
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "simple" | "compuesta")}
              className="form-input"
              required
            >
              <option value="simple">Simple (valor de entrada)</option>
              <option value="compuesta">Compuesta (fórmula interna)</option>
            </select>
          </div>
          <FormUnitSelect
            label="Unidad de medida"
            name="unidad_medida"
            optional
            placeholder="Opcional"
          />
          {tipo === "compuesta" && (
            <FormField label="Fórmula compuesta" name="formula_compuesta" required>
              <textarea
                name="formula_compuesta"
                placeholder="Ej: reservas_web / visitas_mes"
                required
                rows={3}
                className="form-input font-mono"
              />
            </FormField>
          )}
          {error && <FormError message={error} />}
          <FormActions
            onCancel={closeCreateModal}
            submitLabel="Guardar variable"
            pending={pending}
            pendingLabel="Guardando..."
          />
        </form>
      </FormModal>

      <ConfirmDialog
        open={!!toDelete}
        title={`Eliminar variable "${toDelete?.codigo}"`}
        description={
          affectedKpis.length > 0
            ? "Si elimina esta variable, todos los indicadores que la utilicen deberán ser eliminados."
            : "Esta variable no está en uso por ningún indicador activo."
        }
        confirmLabel="Eliminar variable"
        cancelLabel="Cancelar"
        variant="danger"
        loading={pending || deleteLoading}
        confirmDisabled={deleteLoading || !deleteUsage}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
      >
        {deleteError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {deleteError}
          </p>
        )}
        {deleteLoading && (
          <p className="mt-3 text-sm text-slate-500">Verificando indicadores afectados…</p>
        )}
        {!deleteLoading && affectedKpis.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-sm font-medium text-amber-900">
              Indicadores que serán eliminados ({affectedKpis.length}):
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-amber-800">
              {affectedKpis.map((kpi) => (
                <li key={kpi.id}>
                  <span className="font-mono">{kpi.codigo}</span> — {kpi.nombre}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!deleteLoading && (deleteUsage?.compositeVariables.length ?? 0) > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-sm font-medium text-slate-700">
              Variables compuestas que también se eliminarán (
              {deleteUsage?.compositeVariables.length}):
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {deleteUsage?.compositeVariables.map((v) => (
                <li key={v.id}>
                  <span className="font-mono">{v.codigo}</span> — {v.nombre}
                </li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

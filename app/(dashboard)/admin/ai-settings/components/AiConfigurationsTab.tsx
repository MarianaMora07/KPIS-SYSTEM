"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Eye,
  EyeOff,
  Brain,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Key,
  Cpu,
  Hash,
} from "lucide-react";
import {
  FormModal,
  FormField,
  FormActions,
  FormError,
} from "@/components/ui/form-modal";
import { useSuccessToast } from "@/components/ui/success-toast";
import type {
  AiConfigurationRow,
  AiProvider,
  AiModel,
} from "../actions/ai-settings-actions";
import {
  saveAiConfiguration,
  toggleAiConfigurationStatus,
  getAiConfigurations,
  getAiProvidersCatalog,
  createAiProvider,
  getAiModelsByProvider,
  deleteAiConfiguration,
} from "../actions/ai-settings-actions";

interface AiConfigurationsTabProps {
  initialConfigurations: AiConfigurationRow[];
  providers: AiProvider[];
}

export function AiConfigurationsTab({
  initialConfigurations,
  providers: initialProviders,
}: AiConfigurationsTabProps) {
  const { showSuccess } = useSuccessToast();
  const [configs, setConfigs] = useState(initialConfigurations);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AiConfigurationRow | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Estados para selectores encadenados de modelos
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelCode, setSelectedModelCode] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);



  // Crea el estado para alojar los proveedores
  const [providers, setProviders] = useState<{ id: string; codigo: string; nombre: string }[]>(
    (initialProviders ?? []).map((p) => ({
      id: p.id,
      codigo: p.proveedor,
      nombre: p.nombre,
    }))
  );

  const [isLoadingProviders, setIsLoadingProviders] = useState(true);

  // Lógica de carga de proveedores reutilizable
  const fetchProviders = useCallback(async () => {
    setIsLoadingProviders(true);
    try {
      const data = await getAiProvidersCatalog();
      setProviders(data);
    } catch (err) {
      console.error("Error loading providers:", err);
    } finally {
      setIsLoadingProviders(false);
    }
  }, []);

  // Llama a la base de datos cuando el componente se monte
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchProviders();
    });
  }, [fetchProviders]);

  // Sincronizar modelos basados en el proveedor de IA seleccionado
  useEffect(() => {
    if (!selectedProviderId) {
      Promise.resolve().then(() => {
        setAvailableModels([]);
        setIsLoadingModels(false);
      });
      return;
    }

    let active = true;
    Promise.resolve().then(() => {
      setIsLoadingModels(true);
    });

    getAiModelsByProvider(selectedProviderId)
      .then((models) => {
        if (active) {
          setAvailableModels(models);
        }
      })
      .catch((err) => {
        console.error("Error cargando modelos de IA:", err);
        if (active) {
          setAvailableModels([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingModels(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedProviderId]);

  async function handleDelete(cfg: AiConfigurationRow) {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la configuración de ${cfg.provider_nombre}?`)) {
      return;
    }

    const result = await deleteAiConfiguration(cfg.id);
    if (result.ok) {
      showSuccess("Configuración eliminada con éxito");
      refresh();
    } else {
      alert(result.error ?? "Error al eliminar la configuración");
    }
  }

  const refresh = useCallback(() => {
    startTransition(async () => {
      const updated = await getAiConfigurations();
      setConfigs(updated);
    });
  }, []);

  function openNew() {
    setEditTarget(null);
    setErrorMsg("");
    setShowKey(false);
    setSelectedProviderId("");
    setSelectedModelCode("");
    setModalOpen(true);
  }

  function openEdit(cfg: AiConfigurationRow) {
    setEditTarget(cfg);
    setErrorMsg("");
    setShowKey(false);
    setSelectedProviderId(cfg.provider_id);
    setSelectedModelCode(cfg.modelo_defecto);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    const fd = new FormData(e.currentTarget);

    const result = await saveAiConfiguration({
      provider_id: fd.get("provider_id") as string,
      modelo_defecto: fd.get("modelo_defecto") as string,
      cuota_mensual_tokens: Number(fd.get("cuota_mensual_tokens")),
      api_key_plain: fd.get("api_key_plain") as string,
      descripcion: (fd.get("descripcion") as string) || undefined,
      ranking: Number(fd.get("ranking")),
      configuration_id: editTarget?.id ?? undefined,
    });

    if (!result.ok) {
      setErrorMsg(result.error ?? "Error desconocido");
      return;
    }

    setModalOpen(false);
    showSuccess(
      editTarget
        ? "Configuración actualizada con éxito"
        : "Configuración creada con éxito"
    );
    refresh();
  }

  async function handleToggle(cfg: AiConfigurationRow) {
    const newEstado = cfg.estado === "activo" ? "inactivo" : "activo";
    const result = await toggleAiConfigurationStatus(cfg.id, newEstado);
    if (result.ok) {
      showSuccess(
        newEstado === "activo" ? "Proveedor activado" : "Proveedor desactivado"
      );
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-imperial-900">
            Configuraciones de API
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Las API Keys se almacenan cifradas con AES-256 vía pgp_sym_encrypt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-all hover:border-imperial-700/30 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw
              className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
            />
            Actualizar
          </button>
          <button
            type="button"
            id="btn-nueva-configuracion"
            onClick={openNew}
            className="btn-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Nueva Configuración
          </button>
        </div>
      </div>

      {/* Table */}
      {configs.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ranking
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Proveedor
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Modelo
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cuota Mensual
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  API Key
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {configs.map((cfg) => (
                  <motion.tr
                    key={cfg.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center justify-center rounded-lg bg-imperial-900/10 px-2.5 py-1 text-xs font-bold text-imperial-900">
                        #{cfg.ranking}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-imperial-900/10">
                          <Brain className="h-4 w-4 text-imperial-900" />
                        </div>
                        <div>
                          <p className="font-medium text-imperial-900">
                            {cfg.provider_nombre}
                          </p>
                          <p className="text-xs text-slate-400">
                            {cfg.provider_proveedor}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-600">
                        <Cpu className="h-3 w-3" />
                        {cfg.modelo_defecto}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-imperial-900">
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                        {cfg.cuota_mensual_tokens.toLocaleString()} tokens/mes
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 font-mono text-xs text-amber-800">
                        <Key className="h-3 w-3" />
                        {cfg.api_key_masked}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusToggle
                        estado={cfg.estado}
                        onToggle={() => handleToggle(cfg)}
                      />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(cfg)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-imperial-900 transition-all hover:border-imperial-700/40 hover:bg-imperial-900/5"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cfg)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-all hover:border-red-400 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editTarget ? "Editar Configuración de IA" : "Nueva Configuración de IA"
        }
        subtitle="La API Key se almacenará cifrada con AES-256. Nunca se envía en texto plano."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proveedor */}
          <div>
            <label className="form-label">Proveedor de IA</label>
            <select
              name="provider_id"
              required
              value={selectedProviderId}
              onChange={(e) => {
                setSelectedProviderId(e.target.value);
                setSelectedModelCode("");
              }}
              className="form-input mt-1.5"
            >
              <option value="" disabled>
                Seleccionar proveedor…
              </option>
              {isLoadingProviders ? (
                <option value="loading" disabled>Cargando proveedores...</option>
              ) : providers.length === 0 ? (
                <option value="empty" disabled>No hay proveedores activos</option>
              ) : (
                providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.nombre} ({provider.codigo})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Modelo */}
          <div>
            <label className="form-label">Modelo por defecto</label>
            <select
              name="modelo_defecto"
              required
              value={selectedModelCode}
              onChange={(e) => setSelectedModelCode(e.target.value)}
              disabled={!selectedProviderId || isLoadingModels}
              className="form-input mt-1.5"
            >
              <option value="" disabled>
                {!selectedProviderId
                  ? "Selecciona un proveedor primero"
                  : isLoadingModels
                    ? "Cargando modelos..."
                    : availableModels.length === 0
                      ? "No hay modelos activos para este proveedor"
                      : "Seleccionar modelo…"}
              </option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.codigo}>
                  {model.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Cuota */}
          <FormField
            label="Cuota mensual (tokens)"
            name="cuota_mensual_tokens"
            type="number"
            required
            placeholder="1000000"
            defaultValue={
              editTarget
                ? String(editTarget.cuota_mensual_tokens)
                : "1000000"
            }
          />

          {/* Ranking de uso */}
          <div>
            <label className="form-label">Ranking de uso (prioridad)</label>
            <input
              name="ranking"
              type="number"
              required
              min="1"
              placeholder="1"
              defaultValue={
                editTarget
                  ? String(editTarget.ranking)
                  : "1"
              }
              className="form-input mt-1.5"
            />
            <p className="mt-1 text-xs text-slate-400">
              1 es la prioridad más alta (se usará primero), 2 la segunda, etc.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="form-label">
              API Key{" "}
              {editTarget && (
                <span className="font-normal text-slate-400">
                  (dejar vacío para no cambiar)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                name="api_key_plain"
                type={showKey ? "text" : "password"}
                required={!editTarget}
                placeholder={
                  editTarget ? "••••••••••••" : "Pega aquí tu API Key"
                }
                className="form-input pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-imperial-900 transition-colors"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Descripción */}
          <FormField
            label="Descripción (opcional)"
            name="descripcion"
            placeholder="Ej. Llave para producción — proyecto X"
            defaultValue={editTarget?.descripcion ?? ""}
          />

          {errorMsg && <FormError message={errorMsg} />}

          <FormActions
            submitLabel={editTarget ? "Guardar cambios" : "Crear configuración"}
            onCancel={() => setModalOpen(false)}
            pending={isPending}
          />
        </form>
      </FormModal>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StatusToggle({
  estado,
  onToggle,
}: {
  estado: "activo" | "inactivo";
  onToggle: () => void;
}) {
  const active = estado === "activo";
  return (
    <button
      type="button"
      onClick={onToggle}
      id={`toggle-status-${active ? "activo" : "inactivo"}`}
      aria-pressed={active}
      className="group flex items-center gap-2"
    >
      {/* Track */}
      <div
        className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
          active ? "bg-emerald-500" : "bg-slate-200"
        }`}
      >
        {/* Thumb */}
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            active ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold ${
          active ? "text-emerald-600" : "text-slate-400"
        }`}
      >
        {active ? (
          <>
            <CheckCircle className="h-3.5 w-3.5" />
            Activo
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5" />
            Inactivo
          </>
        )}
      </span>
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-imperial-900/8">
        <Brain className="h-8 w-8 text-imperial-900/60" />
      </div>
      <h4 className="text-base font-semibold text-imperial-900">
        Sin configuraciones
      </h4>
      <p className="mt-1 max-w-xs text-sm text-slate-400">
        Añade tu primera configuración de proveedor IA para habilitar las
        funciones de inteligencia artificial.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="btn-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" />
        Nueva Configuración
      </button>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UploadCloud, Paperclip, X } from "lucide-react";
import {
  getKpiFormulaVariableCodesAction,
  registerKpiValueAction,
} from "@/modules/kpis/actions/kpi-actions";
import { previewValueTargetMatchesAction } from "@/modules/metas/actions/targets-actions";
import { KpiDimensionFields } from "@/modules/kpis/components/kpi-dimension-fields";
import { RegisterValueTargetPreview } from "@/modules/kpis/components/register-value-target-preview";
import { resolveValueDimensions } from "@/lib/kpis/dimension-scope";
import type { DimensionCatalogs, KpiDimensionScope } from "@/lib/kpis/dimension-scope";
import {
  formatTargetPeriodLabel,
  formatTargetScopeLabel,
  type TargetRowForMatch,
} from "@/lib/metas/match-value-to-targets";
import type { KpiValueInput } from "@/lib/validations/schemas";
import { usePermissions } from "@/components/layout/permissions-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GUIDED_SUCCESS, useSuccessToast } from "@/components/ui/success-toast";
import {
  FormModal,
  FormSelect,
  FormField,
  FormActions,
  FormError,
  FormSecondaryButton,
} from "@/components/ui/form-modal";
import { KpiSqlLoadButton } from "@/modules/sql-data-sources/components/kpi-sql-load-button";

const EMPTY_VARIABLE_CODES: string[] = [];
const EMPTY_SCOPE: Partial<KpiDimensionScope> = {};
const EMPTY_CATALOGS: DimensionCatalogs = {};

export interface RegisterValueKpi {
  id: string;
  codigo: string;
  nombre: string;
  hotel_id?: string | null;
  region_id?: string | null;
  business_unit_id?: string | null;
  sales_channel_id?: string | null;
  marketing_campaign_id?: string | null;
  commercial_team_id?: string | null;
}

interface RegisterValueFormProps {
  kpis: RegisterValueKpi[];
  defaultKpiId?: string;
  formulaVariableCodes?: string[];
  kpiScopeDefaults?: Partial<KpiDimensionScope>;
  dimensionCatalogs?: DimensionCatalogs;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hasSqlSource?: boolean;
}

export function RegisterValueForm({
  kpis,
  defaultKpiId,
  formulaVariableCodes = EMPTY_VARIABLE_CODES,
  kpiScopeDefaults = EMPTY_SCOPE,
  dimensionCatalogs = EMPTY_CATALOGS,
  open: controlledOpen,
  onOpenChange,
  hasSqlSource = false,
}: RegisterValueFormProps) {
  const { can } = usePermissions();
  const { showGuidedSuccess } = useSuccessToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [variableCodes, setVariableCodes] = useState<string[]>(formulaVariableCodes);
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [previewFecha, setPreviewFecha] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [matchedTargets, setMatchedTargets] = useState<TargetRowForMatch[]>([]);
  const [nonMatchedTargets, setNonMatchedTargets] = useState<TargetRowForMatch[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRegister, setPendingRegister] = useState<KpiValueInput | null>(null);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [prefillFecha, setPrefillFecha] = useState<string | null>(null);
  const [selectedKpiId, setSelectedKpiId] = useState(
    () => defaultKpiId ?? kpis[0]?.id ?? ""
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const showKpiPicker = kpis.length > 1;
  const activeKpi = kpis.find((k) => k.id === selectedKpiId) ?? kpis[0];
  const activeScopeDefaults = useMemo((): Partial<KpiDimensionScope> => {
    if (
      defaultKpiId &&
      selectedKpiId === defaultKpiId &&
      kpiScopeDefaults !== EMPTY_SCOPE
    ) {
      return kpiScopeDefaults;
    }
    if (!activeKpi) return EMPTY_SCOPE;
    return {
      hotel_id: activeKpi.hotel_id ?? null,
      region_id: activeKpi.region_id ?? null,
      business_unit_id: activeKpi.business_unit_id ?? null,
      sales_channel_id: activeKpi.sales_channel_id ?? null,
      marketing_campaign_id: activeKpi.marketing_campaign_id ?? null,
      commercial_team_id: activeKpi.commercial_team_id ?? null,
    };
  }, [activeKpi, defaultKpiId, kpiScopeDefaults, selectedKpiId]);

  const fallbackCodesRef = useRef(formulaVariableCodes);
  fallbackCodesRef.current = formulaVariableCodes;

  const refreshPreview = useCallback(async () => {
    const form = formRef.current;
    if (!form || !selectedKpiId) return;

    const fd = new FormData(form);
    const fecha = (fd.get("fecha") as string) || "";
    setPreviewFecha(fecha);
    if (!fecha) {
      setMatchedTargets([]);
      setNonMatchedTargets([]);
      return;
    }

    const dimensions = resolveDimensionsFromForm(fd, activeScopeDefaults);
    setLoadingPreview(true);
    try {
      const result = await previewValueTargetMatchesAction(selectedKpiId, {
        fecha,
        hotel_id: dimensions.hotel_id,
        region_id: dimensions.region_id,
        marketing_campaign_id: dimensions.marketing_campaign_id,
      });
      setMatchedTargets(result.matches);
      setNonMatchedTargets(result.nonMatches);
    } catch {
      setMatchedTargets([]);
      setNonMatchedTargets([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedKpiId, activeScopeDefaults]);

  const schedulePreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void refreshPreview();
    }, 300);
  }, [refreshPreview]);

  useEffect(() => {
    if (!open || !selectedKpiId) return;

    let cancelled = false;
    setLoadingVariables(true);

    getKpiFormulaVariableCodesAction(selectedKpiId)
      .then((codes) => {
        if (!cancelled) setVariableCodes(codes);
      })
      .catch(() => {
        if (!cancelled) setVariableCodes(fallbackCodesRef.current);
      })
      .finally(() => {
        if (!cancelled) setLoadingVariables(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedKpiId]);

  useEffect(() => {
    if (open) {
      setSelectedKpiId(defaultKpiId ?? kpis[0]?.id ?? "");
    }
  }, [open, defaultKpiId, kpis]);

  useEffect(() => {
    if (open) {
      void refreshPreview();
    } else {
      setConfirmOpen(false);
      setPendingRegister(null);
      setMatchedTargets([]);
      setNonMatchedTargets([]);
      setPreviewFecha("");
      setSelectedFiles([]);
    }
  }, [open, refreshPreview]);

  useEffect(() => {
    if (!open || !selectedKpiId) return;
    schedulePreview();
  }, [open, selectedKpiId, schedulePreview]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  if (!can("metas.configurar") || kpis.length === 0) return null;

  const usesFormula = variableCodes.length > 0;

  function handleKpiChange(kpiId: string) {
    setSelectedKpiId(kpiId);
    setPrefill({});
    setPrefillFecha(null);
    setMatchedTargets([]);
    setNonMatchedTargets([]);
    setPreviewFecha("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = buildRegisterPayload(fd, usesFormula);
    const dimensions = resolveDimensionsFromForm(fd, activeScopeDefaults);

    startTransition(async () => {
      try {
        const result = await previewValueTargetMatchesAction(payload.kpi_id, {
          fecha: payload.fecha,
          hotel_id: dimensions.hotel_id,
          region_id: dimensions.region_id,
          marketing_campaign_id: dimensions.marketing_campaign_id,
        });
        setMatchedTargets(result.matches);
        setNonMatchedTargets(result.nonMatches);
        setPendingRegister(payload);
        setConfirmOpen(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo verificar las metas"
        );
      }
    });
  }

  function handleConfirmRegister() {
    if (!pendingRegister) return;
    setError(null);
    startTransition(async () => {
      try {
        let attachments: { name: string; url: string }[] = [];
        if (selectedFiles.length > 0) {
          const supabase = createClient();
          for (const file of selectedFiles) {
            const ext = file.name.split(".").pop();
            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
            const filePath = `${pendingRegister.kpi_id}/${Date.now()}_${cleanName}`;
            const { error: uploadError } = await supabase.storage
              .from("kpi-evidences")
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from("kpi-evidences")
              .getPublicUrl(filePath);

            attachments.push({
              name: file.name,
              url: urlData.publicUrl,
            });
          }
        }

        const result = await registerKpiValueAction(pendingRegister, attachments);
        setConfirmOpen(false);
        setPendingRegister(null);
        setSelectedFiles([]);
        setOpen(false);

        if (result && "approvalRequired" in result && result.approvalRequired) {
          showGuidedSuccess({
            title: "Solicitud de medición registrada",
            message: "El registro de valor ha sido enviado para revisión de un Director.",
            instructions: [
              "La medición no alimentará el dashboard ni el histórico hasta ser aprobada.",
              "Puede revisar el estado de las aprobaciones en la sección correspondiente.",
            ],
          });
          formRef.current?.reset();
          router.refresh();
          return;
        }

        showGuidedSuccess(GUIDED_SUCCESS.valueRegistered);
        formRef.current?.reset();
        router.push(
          `/kpis/${pendingRegister.kpi_id}?tab=seguimiento&valor=${pendingRegister.fecha}`
        );
        router.refresh();
      } catch (err) {
        setConfirmOpen(false);
        setError(err instanceof Error ? err.message : "Error al registrar valor");
      }
    });
  }

  const confirmVariant = matchedTargets.length > 0 ? "default" : "warning";
  const confirmTitle =
    matchedTargets.length > 0
      ? "Confirmar registro de valor"
      : "Ninguna meta coincide con esta fecha";
  const confirmDescription =
    matchedTargets.length > 0
      ? `El valor del ${pendingRegister?.fecha} se usará para calcular el cumplimiento de las metas listadas.`
      : "Puede ajustar la fecha en el formulario o registrar el valor de todos modos (no alimentará metas existentes).";

  return (
    <>
      <FormSecondaryButton onClick={() => setOpen(true)}>Registrar valor</FormSecondaryButton>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar valor de KPI"
        subtitle={
          usesFormula
            ? "Ingrese cada variable; el valor del KPI se calcula con la fórmula configurada"
            : "Revise qué metas aplican según la fecha y el alcance antes de guardar"
        }
        maxWidth="md"
      >
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onChange={schedulePreview}
          className="space-y-4"
        >
          {showKpiPicker ? (
            <FormSelect
              label="KPI *"
              name="kpi_id"
              required
              value={selectedKpiId}
              onChange={(e) => handleKpiChange(e.target.value)}
              options={kpis.map((k) => ({
                id: k.id,
                nombre: `${k.codigo} — ${k.nombre}`,
              }))}
            />
          ) : (
            <input type="hidden" name="kpi_id" value={selectedKpiId} />
          )}
          {!showKpiPicker && activeKpi && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {activeKpi.codigo} — {activeKpi.nombre}
            </p>
          )}
          <FormField
            label="Fecha *"
            name="fecha"
            type="date"
            required
            defaultValue={prefillFecha ?? new Date().toISOString().slice(0, 10)}
            key={prefillFecha ?? "fecha-default"}
          />
          {selectedKpiId && (
            <KpiDimensionFields
              kpiDefaults={activeScopeDefaults}
              catalogs={dimensionCatalogs}
            />
          )}
          {selectedKpiId && (
            <RegisterValueTargetPreview
              fecha={previewFecha}
              matches={matchedTargets}
              nonMatches={nonMatchedTargets}
              loading={loadingPreview}
              catalogs={dimensionCatalogs}
            />
          )}
          {usesFormula ? (
            loadingVariables ? (
              <p className="text-sm text-slate-500">Cargando variables de la fórmula…</p>
            ) : (
              variableCodes.map((code) => (
                <FormField
                  key={`${code}-${prefill[code] ?? ""}`}
                  label={`${code} *`}
                  name={`var_${code}`}
                  type="number"
                  step="any"
                  required
                  defaultValue={prefill[code]}
                />
              ))
            )
          ) : (
            <FormField
              label="Valor real *"
              name="valor_real"
              type="number"
              step="any"
              required
            />
          )}

          {/* Dropzone para archivos de soporte opcionales */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Documentos de soporte (Opcional)
            </label>
            <div className="relative border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 rounded-xl p-4 transition-all flex flex-col items-center justify-center cursor-pointer bg-slate-50/20">
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
              <p className="text-xs font-medium text-slate-600">
                Arrastre archivos aquí o haga clic para seleccionar
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                PDF, Excel, imágenes, etc. (Máx. 10MB)
              </p>
            </div>
            {selectedFiles.length > 0 && (
              <ul className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                  <li key={idx} className="py-1 flex items-center justify-between">
                    <span className="truncate max-w-[200px] flex items-center gap-1.5" title={file.name}>
                      <Paperclip className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <FormError message={error} />}
          {hasSqlSource && selectedKpiId && (
            <KpiSqlLoadButton
              kpiId={selectedKpiId}
              variant="form"
              onPrefill={({ fecha, variables }) => {
                setPrefillFecha(fecha);
                const next: Record<string, string> = {};
                for (const [k, v] of Object.entries(variables)) {
                  next[k] = String(v);
                }
                setPrefill(next);
              }}
            />
          )}
          <FormActions
            onCancel={() => setOpen(false)}
            submitLabel="Registrar valor"
            pending={pending}
          />
        </form>
      </FormModal>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={matchedTargets.length > 0 ? "Confirmar y guardar" : "Registrar igualmente"}
        cancelLabel="Volver y ajustar"
        variant={confirmVariant}
        loading={pending}
        onConfirm={handleConfirmRegister}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingRegister(null);
        }}
      >
        {matchedTargets.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {matchedTargets.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-green-100 bg-green-50/60 px-3 py-2 text-sm text-green-950"
              >
                <span className="font-medium">
                  {formatTargetScopeLabel(t, dimensionCatalogs)}
                </span>
                <span className="mt-0.5 block text-xs text-green-900/85">
                  {formatTargetPeriodLabel(t.periodo_tipo)} · {t.fecha_inicio} — {t.fecha_fin} ·
                  meta {t.valor_meta}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          nonMatchedTargets.length > 0 && (
            <ul className="mt-3 space-y-2">
              {nonMatchedTargets.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                >
                  {formatTargetScopeLabel(t, dimensionCatalogs)} · {t.fecha_inicio} —{" "}
                  {t.fecha_fin}
                </li>
              ))}
            </ul>
          )
        )}
      </ConfirmDialog>
    </>
  );
}

function pickDimension(fd: FormData, name: string): string | null {
  const raw = fd.get(name);
  return raw != null && String(raw).trim() !== "" ? String(raw) : null;
}

function resolveDimensionsFromForm(
  fd: FormData,
  kpiScopeDefaults: Partial<KpiDimensionScope>
): KpiDimensionScope {
  return resolveValueDimensions(
    {
      hotel_id: pickDimension(fd, "hotel_id"),
      region_id: pickDimension(fd, "region_id"),
      business_unit_id: pickDimension(fd, "business_unit_id"),
      sales_channel_id: pickDimension(fd, "sales_channel_id"),
      marketing_campaign_id: pickDimension(fd, "marketing_campaign_id"),
      commercial_team_id: pickDimension(fd, "commercial_team_id"),
    },
    kpiScopeDefaults
  );
}

function buildRegisterPayload(fd: FormData, usesFormula: boolean): KpiValueInput {
  const kpi_id = fd.get("kpi_id") as string;
  const fecha = fd.get("fecha") as string;

  const variable_inputs: Record<string, number> = {};
  if (usesFormula) {
    for (const [key, val] of fd.entries()) {
      if (key.startsWith("var_") && String(val).trim() !== "") {
        variable_inputs[key.slice(4)] = Number(val);
      }
    }
  }

  const valorRaw = fd.get("valor_real");
  const valor_real =
    valorRaw != null && String(valorRaw).trim() !== "" ? Number(valorRaw) : undefined;

  return {
    kpi_id,
    fecha,
    valor_real,
    variable_inputs: usesFormula ? variable_inputs : undefined,
    hotel_id: pickDimension(fd, "hotel_id"),
    region_id: pickDimension(fd, "region_id"),
    business_unit_id: pickDimension(fd, "business_unit_id"),
    sales_channel_id: pickDimension(fd, "sales_channel_id"),
    marketing_campaign_id: pickDimension(fd, "marketing_campaign_id"),
    commercial_team_id: pickDimension(fd, "commercial_team_id"),
  };
}

"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getKpiFormulaVariableCodesAction,
  registerKpiValueAction,
} from "@/modules/kpis/actions/kpi-actions";
import { previewValueTargetMatchesAction } from "@/modules/metas/actions/targets-actions";
import { KpiDimensionFields } from "@/modules/kpis/components/kpi-dimension-fields";
import { RegisterValueTargetPreview } from "@/modules/kpis/components/register-value-target-preview";
import { resolveValueDimensions } from "@/lib/kpis/dimension-scope";
import type { DimensionCatalogs, KpiDimensionScope } from "@/lib/kpis/dimension-scope";
import type { TargetRowForMatch } from "@/lib/metas/match-value-to-targets";
import {
  formatTargetPeriodLabel,
  formatTargetScopeLabel,
} from "@/lib/metas/match-value-to-targets";
import type { KpiValueInput } from "@/lib/validations/schemas";
import { usePermissions } from "@/components/layout/permissions-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import {
  FormModal,
  FormSelect,
  FormField,
  FormActions,
  FormError,
  FormSecondaryButton,
} from "@/components/ui/form-modal";

const EMPTY_VARIABLE_CODES: string[] = [];
const EMPTY_SCOPE: Partial<KpiDimensionScope> = {};
const EMPTY_CATALOGS: DimensionCatalogs = {};

interface RegisterValueFormProps {
  kpis: { id: string; codigo: string; nombre: string }[];
  defaultKpiId?: string;
  formulaVariableCodes?: string[];
  kpiScopeDefaults?: Partial<KpiDimensionScope>;
  dimensionCatalogs?: DimensionCatalogs;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RegisterValueForm({
  kpis,
  defaultKpiId,
  formulaVariableCodes = EMPTY_VARIABLE_CODES,
  kpiScopeDefaults = EMPTY_SCOPE,
  dimensionCatalogs = EMPTY_CATALOGS,
  open: controlledOpen,
  onOpenChange,
}: RegisterValueFormProps) {
  const { can } = usePermissions();
  const { showSuccess } = useSuccessToast();
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

  const kpiId = defaultKpiId ?? kpis[0]?.id;
  const singleKpi = kpis.length === 1;
  const fallbackCodesRef = useRef(formulaVariableCodes);
  fallbackCodesRef.current = formulaVariableCodes;

  const refreshPreview = useCallback(async () => {
    const form = formRef.current;
    if (!form || !singleKpi || !kpiId) return;

    const fd = new FormData(form);
    const fecha = (fd.get("fecha") as string) || "";
    setPreviewFecha(fecha);
    if (!fecha) {
      setMatchedTargets([]);
      setNonMatchedTargets([]);
      return;
    }

    const dimensions = resolveDimensionsFromForm(fd, kpiScopeDefaults);
    setLoadingPreview(true);
    try {
      const result = await previewValueTargetMatchesAction(kpiId, {
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
  }, [singleKpi, kpiId, kpiScopeDefaults]);

  const schedulePreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void refreshPreview();
    }, 300);
  }, [refreshPreview]);

  useEffect(() => {
    if (!open || !singleKpi || !kpiId) return;

    let cancelled = false;
    setLoadingVariables(true);

    getKpiFormulaVariableCodesAction(kpiId)
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
  }, [open, singleKpi, kpiId]);

  useEffect(() => {
    if (open) {
      void refreshPreview();
    } else {
      setConfirmOpen(false);
      setPendingRegister(null);
      setMatchedTargets([]);
      setNonMatchedTargets([]);
      setPreviewFecha("");
    }
  }, [open, refreshPreview]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  if (!can("metas.configurar") || kpis.length === 0) return null;

  const usesFormula = variableCodes.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = buildRegisterPayload(fd, usesFormula);
    setPendingRegister(payload);
    setConfirmOpen(true);
  }

  function handleConfirmRegister() {
    if (!pendingRegister) return;
    setError(null);
    startTransition(async () => {
      try {
        await registerKpiValueAction(pendingRegister);
        setConfirmOpen(false);
        setPendingRegister(null);
        setOpen(false);
        showSuccess(SUCCESS_MESSAGES.created);
        formRef.current?.reset();
        router.push(`/kpis/${pendingRegister.kpi_id}?tab=seguimiento&valor=${pendingRegister.fecha}`);
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
          {singleKpi ? (
            <input type="hidden" name="kpi_id" value={defaultKpiId ?? kpis[0].id} />
          ) : (
            <FormSelect
              label="KPI *"
              name="kpi_id"
              required
              defaultValue={defaultKpiId}
              options={kpis.map((k) => ({
                id: k.id,
                nombre: `${k.codigo} — ${k.nombre}`,
              }))}
            />
          )}
          {singleKpi && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {kpis[0].codigo} — {kpis[0].nombre}
            </p>
          )}
          <FormField
            label="Fecha *"
            name="fecha"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          {singleKpi && (
            <KpiDimensionFields
              kpiDefaults={kpiScopeDefaults}
              catalogs={dimensionCatalogs}
            />
          )}
          {singleKpi && (
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
                  key={code}
                  label={`${code} *`}
                  name={`var_${code}`}
                  type="number"
                  step="any"
                  required
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
          {error && <FormError message={error} />}
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

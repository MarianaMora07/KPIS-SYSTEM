"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getKpiFormulaVariableCodesAction,
  registerKpiValueAction,
} from "@/modules/kpis/actions/kpi-actions";
import { KpiDimensionFields } from "@/modules/kpis/components/kpi-dimension-fields";
import type { DimensionCatalogs, KpiDimensionScope } from "@/lib/kpis/dimension-scope";
import { usePermissions } from "@/components/layout/permissions-context";
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
  /** Variables simples requeridas por la fórmula del KPI (si aplica). */
  formulaVariableCodes?: string[];
  /** Defaults de desglose heredados del KPI. */
  kpiScopeDefaults?: Partial<KpiDimensionScope>;
  /** Catálogos para seleccionar dimensiones no fijadas en el KPI. */
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
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [variableCodes, setVariableCodes] = useState<string[]>(formulaVariableCodes);
  const [loadingVariables, setLoadingVariables] = useState(false);

  const kpiId = defaultKpiId ?? kpis[0]?.id;
  const singleKpi = kpis.length === 1;
  const fallbackCodesRef = useRef(formulaVariableCodes);
  fallbackCodesRef.current = formulaVariableCodes;

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

  if (!can("metas.configurar") || kpis.length === 0) return null;

  const usesFormula = variableCodes.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const kpiId = (fd.get("kpi_id") as string) || defaultKpiId || kpis[0].id;
    const fecha = fd.get("fecha") as string;

    const variable_inputs: Record<string, number> = {};
    if (usesFormula) {
      for (const code of variableCodes) {
        const raw = fd.get(`var_${code}`);
        if (raw != null && String(raw).trim() !== "") {
          variable_inputs[code] = Number(raw);
        }
      }
    }

    const valorRaw = fd.get("valor_real");
    const valor_real =
      valorRaw != null && String(valorRaw).trim() !== "" ? Number(valorRaw) : undefined;

    const pickDimension = (name: string) => {
      const raw = fd.get(name);
      return raw != null && String(raw).trim() !== "" ? (String(raw) as string) : null;
    };

    startTransition(async () => {
      try {
        await registerKpiValueAction({
          kpi_id: kpiId,
          fecha,
          valor_real,
          variable_inputs: usesFormula ? variable_inputs : undefined,
          valor_meta: fd.get("valor_meta") ? Number(fd.get("valor_meta")) : null,
          hotel_id: pickDimension("hotel_id"),
          region_id: pickDimension("region_id"),
          business_unit_id: pickDimension("business_unit_id"),
          sales_channel_id: pickDimension("sales_channel_id"),
          marketing_campaign_id: pickDimension("marketing_campaign_id"),
          commercial_team_id: pickDimension("commercial_team_id"),
        });
        setOpen(false);
        showSuccess(SUCCESS_MESSAGES.created);
        (e.target as HTMLFormElement).reset();
        router.push(`/kpis/${kpiId}?valor=${fecha}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al registrar valor");
      }
    });
  }

  return (
    <>
      <FormSecondaryButton onClick={() => setOpen(true)}>
        Registrar valor
      </FormSecondaryButton>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar valor de KPI"
        subtitle={
          usesFormula
            ? "Ingrese cada variable; el valor del KPI se calcula con la fórmula configurada"
            : "El cumplimiento y semáforo se calculan automáticamente"
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <FormField label="Meta (opcional)" name="valor_meta" type="number" step="any" />
          {error && <FormError message={error} />}
          <FormActions
            onCancel={() => setOpen(false)}
            submitLabel="Registrar valor"
            pending={pending}
          />
        </form>
      </FormModal>
    </>
  );
}

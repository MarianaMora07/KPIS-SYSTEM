"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { duplicateKpiAction, deleteKpiValueAction } from "@/modules/kpis/actions/kpi-actions";
import { KpiEditForm } from "@/modules/kpis/components/kpi-edit-form";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import type { KpiFormCatalogs } from "@/modules/kpis/components/kpi-form-fields";
import { KpiReviewNotificationsPanel } from "@/modules/kpis/components/kpi-review-notifications-panel";
import { TargetsPanel } from "@/modules/metas/components/targets-panel";
import { TrafficLightPanel } from "@/modules/metas/components/traffic-light-panel";
import { KpiFormulaSetupPanel } from "@/modules/formulas/components/kpi-formula-setup-panel";
import { RegisterValueForm } from "@/modules/kpis/components/register-value-form";
import {
  KpiValuesAnalyticsPanel,
  type KpiValueRow,
} from "@/modules/kpis/components/kpi-values-analytics-panel";
import { KpiRegisteredValuesPanel } from "@/modules/kpis/components/kpi-registered-values-panel";
import {
  KpiDetailFlowGuide,
  type KpiDetailTab,
} from "@/modules/kpis/components/kpi-detail-flow-guide";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { usePermissions } from "@/components/layout/permissions-context";
import { formatKpiValue } from "@/modules/dashboard/types";
import type { KpiFrequency } from "@/types/database";
import type { DimensionCatalogs } from "@/lib/kpis/dimension-scope";

export type { KpiDetailTab };

interface KpiDetailViewProps {
  kpi: Record<string, unknown>;
  versions: { version: number; created_at: string }[];
  values: KpiValueRow[];
  targets: Record<string, unknown>[];
  regions?: { id: string; nombre: string }[];
  hotels?: { id: string; nombre: string }[];
  trafficLightRanges?: {
    cumplimiento_min_pct: number;
    riesgo_min_pct: number;
    riesgo_max_pct: number;
    incumplimiento_max_pct: number;
  } | null;
  variables?: {
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    formula_compuesta?: string | null;
  }[];
  initialFormula?: string;
  formulaVariableCodes?: string[];
  initialSelectedFecha?: string;
  initialTab?: KpiDetailTab;
  editDefaultValues?: KpiCreateInput;
  editCatalogs?: KpiFormCatalogs;
  dimensionCatalogs?: DimensionCatalogs;
  recordatorioEmailActivo?: boolean;
  recordatorioEmails?: string[];
  ultimoRecordatorioAt?: string | null;
  responsableEmail?: string | null;
}

export function KpiDetailView({
  kpi,
  versions,
  values,
  targets,
  regions = [],
  hotels = [],
  trafficLightRanges = null,
  variables = [],
  initialFormula = "",
  formulaVariableCodes = [],
  initialSelectedFecha,
  initialTab = "seguimiento",
  editDefaultValues,
  editCatalogs,
  dimensionCatalogs = {},
  recordatorioEmailActivo = false,
  recordatorioEmails = [],
  ultimoRecordatorioAt = null,
  responsableEmail = null,
}: KpiDetailViewProps) {
  const { can, canManageUsers } = usePermissions();
  const canEdit = can("kpis.editar");
  const canCreate = can("kpis.crear");
  const canConfigureMetas = can("metas.configurar");
  const { showSuccess } = useSuccessToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<KpiDetailTab>(initialTab);
  const [pending, startTransition] = useTransition();
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [valueToDelete, setValueToDelete] = useState<KpiValueRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const id = kpi.id as string;
  const kpiCodigo = kpi.codigo as string;
  const unidadMedida = (kpi.unidad_medida as string) ?? "";

  const kpiScopeDefaults = useMemo(
    () => ({
      hotel_id: (kpi.hotel_id as string | null) ?? null,
      region_id: (kpi.region_id as string | null) ?? null,
      business_unit_id: (kpi.business_unit_id as string | null) ?? null,
      sales_channel_id: (kpi.sales_channel_id as string | null) ?? null,
      marketing_campaign_id: (kpi.marketing_campaign_id as string | null) ?? null,
      commercial_team_id: (kpi.commercial_team_id as string | null) ?? null,
    }),
    [
      kpi.hotel_id,
      kpi.region_id,
      kpi.business_unit_id,
      kpi.sales_channel_id,
      kpi.marketing_campaign_id,
      kpi.commercial_team_id,
    ]
  );

  const registerKpis = useMemo(
    () => [{ id, codigo: kpiCodigo, nombre: kpi.nombre as string }],
    [id, kpiCodigo, kpi.nombre]
  );

  const setTabWithUrl = useCallback(
    (next: KpiDetailTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "metas") {
        params.set("tab", "metas");
      } else {
        params.delete("tab");
      }
      const qs = params.toString();
      router.replace(qs ? `/kpis/${id}?${qs}` : `/kpis/${id}`, { scroll: false });
    },
    [router, searchParams, id]
  );

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const copy = await duplicateKpiAction(id);
        setShowDuplicateConfirm(false);
        showSuccess(SUCCESS_MESSAGES.created);
        if (copy?.id) router.push(`/kpis/${copy.id}`);
      } catch (err) {
        setShowDuplicateConfirm(false);
        setErrorMsg(err instanceof Error ? err.message : "Error al duplicar");
      }
    });
  }

  function handleConfirmDeleteValue() {
    if (!valueToDelete) return;
    startTransition(async () => {
      try {
        await deleteKpiValueAction(id, valueToDelete.id);
        setValueToDelete(null);
        showSuccess(SUCCESS_MESSAGES.deleted);
        router.refresh();
      } catch (err) {
        setValueToDelete(null);
        setErrorMsg(err instanceof Error ? err.message : "Error al eliminar valor");
      }
    });
  }

  const showFormulaPanel =
    canManageUsers || variables.length > 0 || Boolean(initialFormula);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/kpis"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-imperial-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a KPIs
        </Link>
        <div className="flex gap-2">
          {tab === "seguimiento" && canConfigureMetas && (
            <RegisterValueForm
              kpis={registerKpis}
              defaultKpiId={id}
              formulaVariableCodes={formulaVariableCodes}
              kpiScopeDefaults={kpiScopeDefaults}
              dimensionCatalogs={dimensionCatalogs}
              open={registerOpen}
              onOpenChange={setRegisterOpen}
            />
          )}
          {canEdit && editDefaultValues && editCatalogs && (
            <KpiEditForm
              kpiId={id}
              defaultValues={editDefaultValues}
              catalogs={editCatalogs}
              variables={variables}
              initialFormula={initialFormula}
              variant="modal"
            />
          )}
          {canCreate && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowDuplicateConfirm(true)}
              className="flex items-center gap-1 rounded-lg bg-imperial-900 px-3 py-1.5 text-sm text-white"
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-xl border border-slate-200/60 p-6">
        <p className="font-mono text-xs text-amber-600">{kpiCodigo}</p>
        <h1 className="text-2xl font-semibold text-imperial-900">{kpi.nombre as string}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {kpi.area_responsable as string} · {kpi.frecuencia as string} · v
          {kpi.version_actual as number}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-slate-200 pb-4">
        <div className="flex gap-2">
          <DetailTabButton
            active={tab === "seguimiento"}
            onClick={() => setTabWithUrl("seguimiento")}
          >
            Seguimiento
            {values.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                {values.length}
              </span>
            )}
          </DetailTabButton>
          <DetailTabButton active={tab === "metas"} onClick={() => setTabWithUrl("metas")}>
            Metas y semáforo
            {targets.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                {targets.length}
              </span>
            )}
          </DetailTabButton>
        </div>
        <KpiDetailFlowGuide tab={tab} kpiCodigo={kpiCodigo} />
      </div>

      {tab === "seguimiento" ? (
        <div className="mt-2 space-y-6">
          <KpiValuesAnalyticsPanel
            kpiId={id}
            kpiCodigo={kpiCodigo}
            kpiNombre={kpi.nombre as string}
            unidadMedida={unidadMedida}
            values={values}
            initialSelectedFecha={initialSelectedFecha}
            trafficLightRanges={trafficLightRanges}
          />

          {showFormulaPanel && (
            <KpiFormulaSetupPanel
              kpiId={id}
              kpiNombre={kpi.nombre as string}
              kpiContext={{
                kpi_nombre: kpi.nombre as string,
                unidad_medida: unidadMedida,
                area_responsable: kpi.area_responsable as string,
                tipo_indicador: kpi.tipo_indicador as string,
              }}
              allVariables={variables}
              initialExpresion={initialFormula}
              onFormulaSaved={() => router.refresh()}
              onRequestRegisterValue={
                canConfigureMetas ? () => setRegisterOpen(true) : undefined
              }
            />
          )}

          <KpiRegisteredValuesPanel
            values={values}
            unidadMedida={unidadMedida}
            pending={pending}
            onDelete={setValueToDelete}
          />

          <section className="glass rounded-xl border border-slate-200/60 p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
              Historial de versiones
            </h2>
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.version} className="rounded bg-slate-50 px-3 py-2">
                  v{v.version} — {new Date(v.created_at).toLocaleString("es-CO")}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="mt-2 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <TargetsPanel
              kpiId={id}
              targets={targets}
              regions={regions}
              hotels={hotels}
              campaigns={dimensionCatalogs.campaigns}
            />
            <TrafficLightPanel kpiId={id} initialRanges={trafficLightRanges} />
          </div>

          <KpiReviewNotificationsPanel
            kpiId={id}
            kpiCodigo={kpiCodigo}
            frecuencia={kpi.frecuencia as KpiFrequency}
            activo={recordatorioEmailActivo}
            emails={recordatorioEmails}
            ultimoRecordatorioAt={ultimoRecordatorioAt}
            responsableEmail={responsableEmail}
          />

          {!canConfigureMetas && targets.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Este indicador aún no tiene metas configuradas. Un usuario con permiso de configuración
              de metas puede definirlas aquí.
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showDuplicateConfirm}
        title="Duplicar KPI"
        description={`Se creará una copia de ${kpiCodigo} con metas asociadas. ¿Desea continuar?`}
        confirmLabel="Duplicar"
        cancelLabel="Cancelar"
        variant="default"
        loading={pending}
        onConfirm={handleDuplicate}
        onCancel={() => setShowDuplicateConfirm(false)}
      />

      <ConfirmDialog
        open={!!valueToDelete}
        title="Eliminar valor registrado"
        description={
          valueToDelete
            ? `¿Desea eliminar el registro del ${valueToDelete.fecha} (${formatKpiValue(Number(valueToDelete.valor_real), unidadMedida)})?`
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={pending}
        onConfirm={handleConfirmDeleteValue}
        onCancel={() => setValueToDelete(null)}
      />

      <ConfirmDialog
        open={!!errorMsg}
        title="No se pudo completar la acción"
        description={errorMsg ?? undefined}
        confirmLabel="Entendido"
        variant="danger"
        showCancel={false}
        onConfirm={() => setErrorMsg(null)}
        onCancel={() => setErrorMsg(null)}
      />
    </div>
  );
}

function DetailTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-imperial-900 text-imperial-900"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Pencil, Settings2 } from "lucide-react";
import { updateKpiAction } from "@/modules/kpis/actions/kpi-actions";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import { KpiFormFields, type KpiFormCatalogs } from "./kpi-form-fields";
import {
  KpiFormulaEditStep,
} from "./kpi-formula-edit-step";
import type { FormulaVariableRow } from "./kpi-create-formula-step";
import { usePermissions } from "@/components/layout/permissions-context";
import { FormModal, FormSecondaryButton } from "@/components/ui/form-modal";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";

type EditScreen = "choose" | "datos" | "formula";

interface KpiEditFormProps {
  kpiId: string;
  defaultValues: KpiCreateInput;
  catalogs: KpiFormCatalogs;
  variables?: FormulaVariableRow[];
  initialFormula?: string;
  variant?: "page" | "modal";
}

function StepIndicator({
  step,
  active,
  label,
}: {
  step: number;
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          active ? "bg-imperial-900 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {step}
      </span>
      <span
        className={`text-sm font-medium ${active ? "text-imperial-900" : "text-slate-500"}`}
      >
        {label}
      </span>
    </div>
  );
}

export function KpiEditForm({
  kpiId,
  defaultValues,
  catalogs,
  variables: initialVariables = [],
  initialFormula = "",
  variant = "page",
}: KpiEditFormProps) {
  const { can, canManageUsers } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const router = useRouter();
  const [open, setOpen] = useState(variant === "page");
  const [screen, setScreen] = useState<EditScreen>(variant === "page" ? "choose" : "choose");
  const [variables, setVariables] = useState<FormulaVariableRow[]>(initialVariables);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (justOpened) {
      setVariables(initialVariables);
    }
  }, [open, initialVariables]);

  function resetWizard() {
    setScreen("choose");
    setVariables(initialVariables);
    setError(null);
  }

  function handleClose() {
    if (variant === "modal") setOpen(false);
    else router.push(`/kpis/${kpiId}`);
    resetWizard();
  }

  function handleSubmit(input: KpiCreateInput) {
    setError(null);
    startTransition(async () => {
      try {
        await updateKpiAction(kpiId, input);
        showSuccess(SUCCESS_MESSAGES.updated);
        handleClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar KPI");
      }
    });
  }

  if (!can("kpis.editar")) return null;

  const subtitle =
    screen === "choose"
      ? "Seleccione qué desea editar"
      : screen === "datos"
        ? "Paso 1 — Datos del indicador"
        : "Paso 2 — Fórmula y variables";

  const content = (
    <>
      {screen !== "choose" && (
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
          <StepIndicator step={1} active={screen === "datos"} label="Datos del indicador" />
          <div className="hidden h-px flex-1 bg-slate-200 sm:block" />
          <StepIndicator step={2} active={screen === "formula"} label="Fórmula y variables" />
        </div>
      )}

      {screen === "choose" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Elija la sección que desea modificar para{" "}
            <span className="font-medium text-imperial-900">{defaultValues.nombre}</span>.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScreen("datos")}
              className="rounded-xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-imperial-700/30 hover:bg-slate-50"
            >
              <Settings2 className="mb-2 h-5 w-5 text-imperial-900" />
              <p className="text-sm font-medium text-imperial-900">Datos del indicador</p>
              <p className="mt-1 text-xs text-slate-500">
                Nombre, categoría, meta, frecuencia y demás campos generales.
              </p>
            </button>
            {canManageUsers && (
              <button
                type="button"
                onClick={() => setScreen("formula")}
                className="rounded-xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-amber-400 hover:bg-amber-50/50"
              >
                <Calculator className="mb-2 h-5 w-5 text-amber-700" />
                <p className="text-sm font-medium text-imperial-900">Fórmula y variables</p>
                <p className="mt-1 text-xs text-slate-500">
                  Modificar la expresión y variables de cálculo del indicador.
                </p>
              </button>
            )}
          </div>
          {variant === "modal" ? (
            <div className="flex justify-end border-t border-slate-200 pt-4">
              <FormSecondaryButton onClick={handleClose}>Cancelar</FormSecondaryButton>
            </div>
          ) : (
            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-slate-500 hover:text-imperial-900"
              >
                Volver al indicador
              </button>
            </div>
          )}
        </div>
      )}

      {screen === "datos" && (
        <KpiFormFields
          catalogs={catalogs}
          defaultValues={defaultValues}
          hideFormula
          error={error}
          pending={pending}
          showEstado
          onCancel={() => setScreen("choose")}
          submitLabel="Guardar cambios"
          onSubmit={handleSubmit}
        />
      )}

      {screen === "formula" && canManageUsers && (
        <KpiFormulaEditStep
          kpiId={kpiId}
          kpiNombre={defaultValues.nombre}
          variables={variables}
          onVariablesChange={setVariables}
          initialExpresion={initialFormula}
          onBack={() => setScreen("choose")}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );

  if (variant === "modal") {
    return (
      <>
        <FormSecondaryButton onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Editar
        </FormSecondaryButton>
        <FormModal
          open={open}
          onClose={handleClose}
          title="Editar KPI"
          subtitle={subtitle}
          maxWidth="lg"
        >
          {content}
        </FormModal>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="glass rounded-xl border border-slate-200/60 p-6">
        <h1 className="mb-2 text-xl font-semibold text-imperial-900">Editar KPI</h1>
        <p className="mb-6 text-sm text-slate-500">{subtitle}</p>
        {content}
      </div>
    </div>
  );
}

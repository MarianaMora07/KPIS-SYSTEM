"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createKpiAction } from "@/modules/kpis/actions/kpi-actions";
import { saveFormulaAction } from "@/modules/formulas/actions/formula-actions";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import {
  FormModal,
  FormPrimaryButton,
} from "@/components/ui/form-modal";
import { KpiFormFields, type KpiFormCatalogs } from "./kpi-form-fields";
import {
  KpiCreateFormulaStep,
  type FormulaVariableRow,
} from "./kpi-create-formula-step";
import { usePermissions } from "@/components/layout/permissions-context";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { formatZodError } from "@/lib/validations/format-zod-error";

interface KpiCreateFormProps extends KpiFormCatalogs {
  variables?: FormulaVariableRow[];
}

function StepIndicator({
  step,
  active,
  done,
  label,
}: {
  step: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          active
            ? "bg-imperial-900 text-white"
            : done
              ? "bg-amber-100 text-amber-900"
              : "bg-slate-100 text-slate-500"
        }`}
      >
        {step}
      </span>
      <span
        className={`text-sm font-medium ${
          active ? "text-imperial-900" : done ? "text-amber-800" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function KpiCreateForm({ variables: initialVariables = [], ...catalogs }: KpiCreateFormProps) {
  const { can } = usePermissions();
  const canCreate = can("kpis.crear");
  const { showSuccess } = useSuccessToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [kpiDraft, setKpiDraft] = useState<KpiCreateInput | null>(null);
  const [variables, setVariables] = useState<FormulaVariableRow[]>(initialVariables);
  const [usesFormula, setUsesFormula] = useState<boolean | null>(null);
  const [expresion, setExpresion] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
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
    setStep(1);
    setKpiDraft(null);
    setVariables(initialVariables);
    setUsesFormula(null);
    setExpresion("");
    setSelectedCodes(new Set());
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    resetWizard();
  }

  function handleStep1Submit(input: KpiCreateInput) {
    setError(null);
    setKpiDraft({ ...input, formula: null });
    setStep(2);
  }

  function handleFinalSubmit() {
    if (!kpiDraft) return;
    setError(null);
    startTransition(async () => {
      try {
        const created = await createKpiAction({ ...kpiDraft, formula: null });
        if (usesFormula && expresion.trim() && created?.id) {
          await saveFormulaAction(created.id as string, expresion);
        }
        showSuccess(SUCCESS_MESSAGES.created);
        handleClose();
        router.push(`/kpis/${created.id}`);
        router.refresh();
      } catch (err) {
        setError(formatZodError(err));
      }
    });
  }

  if (!canCreate) {
    return null;
  }

  return (
    <>
      <FormPrimaryButton onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Crear KPI
      </FormPrimaryButton>

      <FormModal
        open={open}
        onClose={handleClose}
        title="Crear KPI"
        subtitle={
          step === 1
            ? "Paso 1 de 2 — Datos del indicador"
            : "Paso 2 de 2 — Fórmula y variables"
        }
        maxWidth="lg"
      >
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
          <StepIndicator
            step={1}
            active={step === 1}
            done={step > 1}
            label="Datos del indicador"
          />
          <div className="hidden h-px flex-1 bg-slate-200 sm:block" />
          <StepIndicator
            step={2}
            active={step === 2}
            done={false}
            label="Fórmula y variables"
          />
        </div>

        {step === 1 ? (
          <KpiFormFields
            catalogs={catalogs}
            defaultValues={kpiDraft ?? undefined}
            hideFormula
            hideCodigo
            error={error}
            pending={pending}
            onCancel={handleClose}
            submitLabel="Continuar"
            onSubmit={handleStep1Submit}
          />
        ) : (
          kpiDraft && (
            <KpiCreateFormulaStep
              kpiNombre={kpiDraft.nombre}
              variables={variables}
              onVariablesChange={setVariables}
              usesFormula={usesFormula}
              onUsesFormulaChange={setUsesFormula}
              expresion={expresion}
              onExpresionChange={setExpresion}
              selectedCodes={selectedCodes}
              onSelectedCodesChange={setSelectedCodes}
              error={error}
              pending={pending}
              onBack={() => {
                setError(null);
                setStep(1);
              }}
              onSubmit={handleFinalSubmit}
            />
          )
        )}
      </FormModal>
    </>
  );
}

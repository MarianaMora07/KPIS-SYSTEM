import { createClient } from "@/lib/supabase/server";
import {
  evaluateFormula,
  extractUsedSymbols,
  resolveVariableScope,
  type VariableDefinition,
} from "@/modules/formulas/utils/formula-engine";

export type FormulaInputs = Record<string, number> | number;

function normalizeScalarToInputs(
  scalar: number,
  variableCodes: string[]
): Record<string, number> {
  const inputs: Record<string, number> = {};
  for (const code of variableCodes) {
    inputs[code] = scalar;
  }
  return inputs;
}

function normalizeInputs(
  raw: FormulaInputs,
  requiredCodes: string[]
): Record<string, number> {
  if (typeof raw === "number") {
    return normalizeScalarToInputs(raw, requiredCodes);
  }
  return raw;
}

export async function getFormulaVariableCodes(kpiId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: formula } = await supabase
    .from("kpi_formulas")
    .select("expresion, es_valida")
    .eq("kpi_id", kpiId)
    .eq("es_valida", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!formula?.expresion) return [];
  return extractUsedSymbols(formula.expresion);
}

/** Códigos de variables simples que el usuario debe ingresar para calcular el KPI. */
export async function getRequiredInputVariableCodes(kpiId: string): Promise<string[]> {
  const formulaCodes = await getFormulaVariableCodes(kpiId);
  if (formulaCodes.length === 0) return [];

  const allVariables = await loadActiveVariables();
  const simpleInputs = new Set<string>();

  function collectSimpleInputs(code: string) {
    const def = allVariables.find((v) => v.codigo === code);
    if (!def) return;
    if (def.tipo === "simple") {
      simpleInputs.add(code);
      return;
    }
    if (def.formula_compuesta) {
      for (const dep of extractUsedSymbols(def.formula_compuesta)) {
        collectSimpleInputs(dep);
      }
    }
  }

  for (const code of formulaCodes) {
    collectSimpleInputs(code);
  }

  return [...simpleInputs];
}

export async function loadActiveVariables(): Promise<VariableDefinition[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kpi_variables")
    .select("codigo, tipo, formula_compuesta")
    .eq("estado", "activo");

  return (data ?? []).map((v) => ({
    codigo: v.codigo,
    tipo: v.tipo as "simple" | "compuesta",
    formula_compuesta: v.formula_compuesta,
  }));
}

export interface ComputeResult {
  valorReal: number;
  variableInputs: Record<string, number> | null;
}

/** Calcula valor_real aplicando fórmula del KPI y resolviendo variables compuestas. */
export async function computeKpiValueFromInputs(
  kpiId: string,
  rawInputs: FormulaInputs
): Promise<ComputeResult> {
  const supabase = await createClient();

  const { data: formula } = await supabase
    .from("kpi_formulas")
    .select("expresion, es_valida")
    .eq("kpi_id", kpiId)
    .eq("es_valida", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!formula?.expresion) {
    const scalar = typeof rawInputs === "number" ? rawInputs : Object.values(rawInputs)[0];
    if (scalar == null || Number.isNaN(scalar)) {
      throw new Error("Se requiere un valor numérico");
    }
    return { valorReal: scalar, variableInputs: null };
  }

  const requiredCodes = extractUsedSymbols(formula.expresion);
  const allVariables = await loadActiveVariables();
  const inputs = normalizeInputs(rawInputs, requiredCodes);

  for (const code of requiredCodes) {
    const def = allVariables.find((v) => v.codigo === code);
    if (def?.tipo === "simple" && inputs[code] == null) {
      throw new Error(`Falta valor para la variable: ${code}`);
    }
  }

  const scope = resolveVariableScope(inputs, allVariables);

  for (const code of requiredCodes) {
    if (scope[code] == null) {
      throw new Error(`No se pudo resolver la variable: ${code}`);
    }
  }

  try {
    const valorReal = evaluateFormula(formula.expresion, scope);
    const storedInputs: Record<string, number> = {};
    for (const code of requiredCodes) {
      if (inputs[code] != null) storedInputs[code] = inputs[code];
    }
    const simpleDeps = new Set<string>();
    for (const code of requiredCodes) {
      const def = allVariables.find((v) => v.codigo === code);
      if (def?.tipo === "compuesta" && def.formula_compuesta) {
        extractUsedSymbols(def.formula_compuesta).forEach((d) => simpleDeps.add(d));
      }
    }
    for (const d of simpleDeps) {
      if (inputs[d] != null) storedInputs[d] = inputs[d];
    }

    return {
      valorReal,
      variableInputs: Object.keys(storedInputs).length > 0 ? storedInputs : null,
    };
  } catch {
    const fallback = typeof rawInputs === "number" ? rawInputs : Object.values(inputs)[0];
    if (fallback != null) {
      return { valorReal: fallback, variableInputs: null };
    }
    throw new Error("Error al evaluar la fórmula del KPI");
  }
}

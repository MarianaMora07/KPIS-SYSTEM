import { createClient } from "@/lib/supabase/server";
import { evaluateFormula } from "@/modules/formulas/utils/formula-engine";

/** Si el KPI tiene fórmula válida, calcula valor_real; si no, devuelve el valor de entrada. */
export async function computeKpiValueReal(
  kpiId: string,
  inputValor: number
): Promise<number> {
  const supabase = await createClient();

  const { data: formula } = await supabase
    .from("kpi_formulas")
    .select("expresion, es_valida")
    .eq("kpi_id", kpiId)
    .eq("es_valida", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!formula?.expresion) return inputValor;

  const { data: variables } = await supabase
    .from("kpi_variables")
    .select("codigo")
    .eq("estado", "activo");

  const scope: Record<string, number> = {};
  for (const v of variables ?? []) {
    scope[v.codigo] = inputValor;
  }

  try {
    return evaluateFormula(formula.expresion, scope);
  } catch {
    return inputValor;
  }
}

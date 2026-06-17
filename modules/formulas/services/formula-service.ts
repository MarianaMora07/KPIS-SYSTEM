import { createClient } from "@/lib/supabase/server";
import {
  validateFormula,
  validateCompositeFormula,
  detectCompositeCycles,
  extractUsedSymbols,
  type VariableDefinition,
} from "../utils/formula-engine";

export async function listVariables() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_variables")
    .select("*")
    .eq("estado", "activo")
    .order("codigo");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createVariable(input: {
  codigo: string;
  nombre: string;
  tipo: "simple" | "compuesta";
  unidad_medida?: string;
  formula_compuesta?: string;
}) {
  const existing = await listVariables();
  const simpleCodes = existing.filter((v) => v.tipo === "simple").map((v) => v.codigo);

  if (input.tipo === "compuesta") {
    if (!input.formula_compuesta?.trim()) {
      throw new Error("Las variables compuestas requieren una fórmula compuesta");
    }
    const validation = validateCompositeFormula(
      input.formula_compuesta,
      simpleCodes,
      input.codigo
    );
    if (!validation.es_valida) {
      throw new Error(validation.errores.join("; "));
    }
  }

  const asDefs: VariableDefinition[] = [
    ...existing.map((v) => ({
      codigo: v.codigo,
      tipo: v.tipo as "simple" | "compuesta",
      formula_compuesta: v.formula_compuesta,
    })),
    {
      codigo: input.codigo,
      tipo: input.tipo,
      formula_compuesta: input.formula_compuesta ?? null,
    },
  ];
  const cycle = detectCompositeCycles(asDefs);
  if (cycle) throw new Error(cycle);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_variables")
    .insert({
      codigo: input.codigo,
      nombre: input.nombre,
      tipo: input.tipo,
      unidad_medida: input.unidad_medida,
      formula_compuesta: input.tipo === "compuesta" ? input.formula_compuesta : null,
      estado: "activo",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getKpiFormula(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_formulas")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getKpiFormulaVariableCodes(kpiId: string): Promise<string[]> {
  const formula = await getKpiFormula(kpiId);
  if (!formula?.expresion || !formula.es_valida) return [];
  return extractUsedSymbols(formula.expresion);
}

async function syncFormulaVariables(
  formulaId: string,
  expresion: string,
  variables: { id: string; codigo: string }[]
) {
  const supabase = await createClient();
  const usedCodes = extractUsedSymbols(expresion);

  await supabase.from("kpi_formula_variables").delete().eq("formula_id", formulaId);

  const rows = variables
    .filter((v) => usedCodes.includes(v.codigo))
    .map((v) => ({
      formula_id: formulaId,
      variable_id: v.id,
      alias: v.codigo,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("kpi_formula_variables").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function saveKpiFormula(
  kpiId: string,
  expresion: string,
  userId: string
) {
  const variables = await listVariables();
  const codes = variables.map((v) => v.codigo);
  const validation = validateFormula(expresion, codes);

  const supabase = await createClient();

  const { data: lastVersion } = await supabase
    .from("kpi_formulas")
    .select("version")
    .eq("kpi_id", kpiId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("kpi_formulas")
    .insert({
      kpi_id: kpiId,
      expresion,
      es_valida: validation.es_valida,
      validada_at: validation.es_valida ? new Date().toISOString() : null,
      created_by: userId,
      version: nextVersion,
      expresion_ast: { variables: extractUsedSymbols(expresion) },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (validation.es_valida) {
    await supabase.from("kpis").update({ formula: expresion }).eq("id", kpiId);
    await syncFormulaVariables(
      data.id,
      expresion,
      variables.map((v) => ({ id: v.id, codigo: v.codigo }))
    );
  }

  return { formula: data, validation };
}

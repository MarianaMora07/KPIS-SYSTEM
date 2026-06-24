import { createClient } from "@/lib/supabase/server";
import {
  validateFormula,
  validateCompositeFormula,
  detectCompositeCycles,
  extractUsedSymbols,
  type VariableDefinition,
} from "../utils/formula-engine";

export interface VariableUsage {
  kpis: { id: string; codigo: string; nombre: string }[];
  compositeVariables: { id: string; codigo: string; nombre: string }[];
}

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

export async function getVariableUsage(variableId: string): Promise<VariableUsage> {
  const variables = await listVariables();
  const variable = variables.find((v) => v.id === variableId);
  if (!variable) throw new Error("Variable no encontrada");

  const codigo = variable.codigo;
  const supabase = await createClient();
  const kpiMap = new Map<string, { id: string; codigo: string; nombre: string }>();

  const { data: links, error: linksError } = await supabase
    .from("kpi_formula_variables")
    .select("formula_id")
    .eq("variable_id", variableId);

  if (linksError) throw new Error(linksError.message);

  const formulaIds = [...new Set((links ?? []).map((l) => l.formula_id))];
  if (formulaIds.length > 0) {
    const { data: formulas, error: formulasError } = await supabase
      .from("kpi_formulas")
      .select("kpi_id")
      .in("id", formulaIds);

    if (formulasError) throw new Error(formulasError.message);

    const kpiIds = [...new Set((formulas ?? []).map((f) => f.kpi_id))];
    if (kpiIds.length > 0) {
      const { data: kpis, error: kpisError } = await supabase
        .from("kpis")
        .select("id, codigo, nombre")
        .in("id", kpiIds)
        .eq("estado", "activo");

      if (kpisError) throw new Error(kpisError.message);
      for (const kpi of kpis ?? []) {
        kpiMap.set(kpi.id, kpi);
      }
    }
  }

  const { data: kpisWithFormula, error: kpisFormulaError } = await supabase
    .from("kpis")
    .select("id, codigo, nombre, formula")
    .eq("estado", "activo")
    .not("formula", "is", null);

  if (kpisFormulaError) throw new Error(kpisFormulaError.message);

  for (const kpi of kpisWithFormula ?? []) {
    if (kpi.formula && extractUsedSymbols(kpi.formula).includes(codigo)) {
      kpiMap.set(kpi.id, {
        id: kpi.id,
        codigo: kpi.codigo,
        nombre: kpi.nombre,
      });
    }
  }

  const compositeVariables = variables
    .filter(
      (v) =>
        v.id !== variableId &&
        v.tipo === "compuesta" &&
        v.formula_compuesta &&
        extractUsedSymbols(v.formula_compuesta).includes(codigo)
    )
    .map((v) => ({ id: v.id, codigo: v.codigo, nombre: v.nombre }));

  return {
    kpis: Array.from(kpiMap.values()),
    compositeVariables,
  };
}

export async function deleteVariable(variableId: string) {
  const usage = await getVariableUsage(variableId);
  const { inactivateKpi } = await import("@/modules/kpis/services/kpi-service");
  const supabase = await createClient();

  for (const kpi of usage.kpis) {
    await inactivateKpi(kpi.id);
  }

  for (const composite of usage.compositeVariables) {
    const { error } = await supabase
      .from("kpi_variables")
      .update({ estado: "inactivo" })
      .eq("id", composite.id);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase
    .from("kpi_variables")
    .update({ estado: "inactivo" })
    .eq("id", variableId);

  if (error) throw new Error(error.message);

  return usage;
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

/** Persiste una nueva versión de fórmula para el KPI (una expresión por indicador; sin variación por dimensión). */
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

/** Elimina la fórmula activa; conserva versiones anteriores en kpi_formulas como historial. */
export async function deleteKpiFormula(kpiId: string, userId: string) {
  const supabase = await createClient();

  const { data: activeFormula } = await supabase
    .from("kpi_formulas")
    .select("version, expresion")
    .eq("kpi_id", kpiId)
    .eq("es_valida", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeFormula?.expresion) {
    throw new Error("Este indicador no tiene fórmula activa");
  }

  const nextVersion = (activeFormula.version ?? 0) + 1;

  const { error: insertError } = await supabase.from("kpi_formulas").insert({
    kpi_id: kpiId,
    expresion: activeFormula.expresion,
    es_valida: false,
    validada_at: null,
    created_by: userId,
    version: nextVersion,
    expresion_ast: { archived: true, previous_expresion: activeFormula.expresion },
  });

  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("kpis")
    .update({ formula: null })
    .eq("id", kpiId);

  if (updateError) throw new Error(updateError.message);

  return { archivedVersion: nextVersion, previousExpresion: activeFormula.expresion };
}
